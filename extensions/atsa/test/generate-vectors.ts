#!/usr/bin/env tsx
/**
 * Regenerates the committed conformance vectors.
 *
 * The signing key is derived from a fixed seed, so the output is byte-for-byte
 * reproducible: anyone can re-run this and diff the result against what is in
 * the repository. Run with: npx tsx extensions/atsa/test/generate-vectors.ts
 *
 * The key is test material and is committed on purpose. It signs nothing real.
 */

import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  type KeyObject,
} from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { canonicalBody } from "../src/canonicalize";
import type { ServerAttestationDocument, TrustRoot } from "../src/types";

const VECTORS = path.join(__dirname, "vectors");

/** Fixed 32-byte seeds: deterministic keys, so the vectors never drift. */
const SEEDS = {
  "key-prod-2026": Buffer.alloc(32, 0x11),
  "key-expired": Buffer.alloc(32, 0x22),
  "key-restricted": Buffer.alloc(32, 0x33),
  "key-untrusted": Buffer.alloc(32, 0x44),
};

const PKCS8_ED25519_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function keyPair(seed: Buffer): {
  privateKey: KeyObject;
  publicKeyBase64: string;
} {
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  // Strip the SPKI header to leave the raw 32-byte public key.
  return {
    privateKey,
    publicKeyBase64: spki
      .subarray(SPKI_ED25519_PREFIX.length)
      .toString("base64"),
  };
}

const keys = Object.fromEntries(
  Object.entries(SEEDS).map(([id, seed]) => [id, keyPair(seed)]),
);

const trustRoot: TrustRoot = {
  scheme: {
    name: "omcp-demo",
    levels: [
      { name: "public", rank: 0, aliases: ["unclassified"] },
      { name: "internal", rank: 10 },
      { name: "confidential", rank: 20, aliases: ["conf"] },
      { name: "secret", rank: 30 },
    ],
  },
  keys: [
    {
      id: "key-prod-2026",
      publicKey: keys["key-prod-2026"].publicKeyBase64,
      approvedClearances: ["public", "internal", "confidential", "secret"],
    },
    {
      id: "key-expired",
      publicKey: keys["key-expired"].publicKeyBase64,
      notAfter: "2026-01-01T00:00:00Z",
      approvedClearances: ["internal"],
    },
    {
      id: "key-restricted",
      publicKey: keys["key-restricted"].publicKeyBase64,
      approvedClearances: ["public"],
    },
  ],
};

function base(
  overrides: Partial<ServerAttestationDocument> = {},
): ServerAttestationDocument {
  return {
    v: 1,
    id: "urn:omcp:server:weather",
    publisher: "Example Tools Ltd",
    version: "2.3.1",
    clearance: "internal",
    capabilities: ["mcp-server"],
    signerKeyId: "key-prod-2026",
    ...overrides,
  };
}

function signed(
  sad: ServerAttestationDocument,
  signerId: keyof typeof SEEDS = "key-prod-2026",
): ServerAttestationDocument {
  const signature = cryptoSign(
    null,
    canonicalBody(sad),
    keys[signerId].privateKey,
  ).toString("base64");
  return { ...sad, signature };
}

interface Vector {
  name: string;
  rule: string;
  description: string;
  sad: ServerAttestationDocument | null;
  context: { origin: string; requiredClearance: string; now: string };
  expect: { admitted: boolean; reason?: string; code?: number };
}

const CONTEXT = {
  origin: "https://tools.example.com",
  requiredClearance: "internal",
  now: "2026-06-01T12:00:00Z",
};

const vectors: Vector[] = [
  {
    name: "admits-a-valid-document",
    rule: "rules 1-8",
    description:
      "A well-formed document, signed by an approved key, at or above the required level.",
    sad: signed(base()),
    context: CONTEXT,
    expect: { admitted: true },
  },
  {
    name: "admits-when-clearance-dominates",
    rule: "rule 7",
    description: "A higher clearance dominates the required level.",
    sad: signed(base({ clearance: "secret" })),
    context: CONTEXT,
    expect: { admitted: true },
  },
  {
    name: "admits-via-clearance-alias",
    rule: "rule 5, rule 7",
    description:
      "An alias resolves to its canonical level; approval is checked against the canonical name.",
    sad: signed(base({ clearance: "conf" })),
    context: CONTEXT,
    expect: { admitted: true },
  },
  {
    name: "admits-when-origin-is-bound",
    rule: "rule 8",
    description: "netAllowedHosts contains the connected origin.",
    sad: signed(
      base({
        netAllowedHosts: [
          "https://tools.example.com",
          "https://backup.example.com",
        ],
      }),
    ),
    context: CONTEXT,
    expect: { admitted: true },
  },
  {
    name: "ignores-unknown-fields",
    rule: "canonicalization",
    description:
      "Unknown fields are ignored and excluded from the canonical body, so they cannot carry signed content.",
    sad: { ...signed(base()), somethingNew: "ignored", nested: { a: 1 } },
    context: CONTEXT,
    expect: { admitted: true },
  },
  {
    name: "rejects-unsupported-version",
    rule: "versioning",
    description:
      "A verifier must reject document versions it does not understand.",
    sad: signed(base({ v: 2 })),
    context: CONTEXT,
    expect: { admitted: false, reason: "unsupported_version", code: 0 },
  },
  {
    name: "rejects-missing-mcp-server-capability",
    rule: "rule 1",
    description: 'capabilities must contain "mcp-server".',
    sad: signed(base({ capabilities: ["something-else"] })),
    context: CONTEXT,
    expect: { admitted: false, reason: "not_mcp_server", code: 1 },
  },
  {
    name: "rejects-absent-document",
    rule: "rule 1",
    description:
      "No attestation at all is unattested; a deny-by-default host rejects it.",
    sad: null,
    context: CONTEXT,
    expect: { admitted: false, reason: "not_mcp_server", code: 1 },
  },
  {
    name: "rejects-unsigned-document",
    rule: "rule 2",
    description: "signerKeyId and signature are both required.",
    sad: base({ signerKeyId: undefined }),
    context: CONTEXT,
    expect: { admitted: false, reason: "unsigned", code: 2 },
  },
  {
    name: "rejects-unknown-signer",
    rule: "rule 3",
    description: "The signer must resolve to a key in the trust root.",
    sad: signed(base({ signerKeyId: "key-untrusted" }), "key-untrusted"),
    context: CONTEXT,
    expect: { admitted: false, reason: "signer_not_trusted", code: 3 },
  },
  {
    name: "rejects-expired-signer",
    rule: "rule 4",
    description:
      "The signing key's validity window must include the evaluation instant.",
    sad: signed(base({ signerKeyId: "key-expired" }), "key-expired"),
    context: CONTEXT,
    expect: { admitted: false, reason: "signer_expired", code: 4 },
  },
  {
    name: "rejects-signer-not-approved-for-clearance",
    rule: "rule 5",
    description:
      "A key approved only for a lower level may not sign a higher one.",
    sad: signed(
      base({ signerKeyId: "key-restricted", clearance: "secret" }),
      "key-restricted",
    ),
    context: CONTEXT,
    expect: { admitted: false, reason: "signer_not_approved", code: 5 },
  },
  {
    name: "rejects-unknown-clearance-level",
    rule: "rule 5",
    description:
      "A clearance outside the scheme cannot be ranked, so it cannot be approved.",
    sad: signed(base({ clearance: "cosmic-top-secret" })),
    context: CONTEXT,
    expect: { admitted: false, reason: "signer_not_approved", code: 5 },
  },
  {
    name: "rejects-tampered-body",
    rule: "rule 6",
    description:
      "Editing a signed field after signing invalidates the signature.",
    sad: { ...signed(base()), version: "9.9.9" },
    context: CONTEXT,
    expect: { admitted: false, reason: "bad_signature", code: 6 },
  },
  {
    name: "rejects-signature-from-wrong-key",
    rule: "rule 6",
    description:
      "A document naming one trusted key but signed by another does not verify.",
    sad: signed(base({ signerKeyId: "key-prod-2026" }), "key-restricted"),
    context: CONTEXT,
    expect: { admitted: false, reason: "bad_signature", code: 6 },
  },
  {
    name: "rejects-clearance-below-required",
    rule: "rule 7",
    description: "A level below the host's requirement does not dominate it.",
    sad: signed(base({ clearance: "public" })),
    context: CONTEXT,
    expect: { admitted: false, reason: "below_required", code: 7 },
  },
  {
    name: "rejects-unbound-origin",
    rule: "rule 8",
    description:
      "When netAllowedHosts is non-empty, the connected origin must be a member.",
    sad: signed(base({ netAllowedHosts: ["https://other.example.com"] })),
    context: CONTEXT,
    expect: { admitted: false, reason: "host_not_bound", code: 8 },
  },
];

fs.mkdirSync(VECTORS, { recursive: true });
for (const file of fs.readdirSync(VECTORS)) fs.rmSync(path.join(VECTORS, file));
fs.writeFileSync(
  path.join(VECTORS, "_trust-root.json"),
  JSON.stringify(trustRoot, null, 2) + "\n",
);
for (const vector of vectors) {
  fs.writeFileSync(
    path.join(VECTORS, `${vector.name}.json`),
    JSON.stringify(vector, null, 2) + "\n",
  );
}
console.log(
  `wrote ${vectors.length} vectors and the trust root to ${path.relative(process.cwd(), VECTORS)}`,
);
