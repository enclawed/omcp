import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPATIBILITY_MODE_ENV,
  DEFAULT_COMPATIBILITY_MODE,
  assertAdditionAllowed,
  omcpAdditionsEnabled,
  parseCompatibilityMode,
  resolveCompatibilityMode,
  INCOMING_ADDITIONS_ARE_IGNORED,
} from "../src/index";

test("the default is no, so omcp's additions are available unless asked otherwise", () => {
  assert.equal(DEFAULT_COMPATIBILITY_MODE, "no");
  assert.equal(resolveCompatibilityMode(undefined, {}), "no");
  assert.equal(
    omcpAdditionsEnabled(resolveCompatibilityMode(undefined, {})),
    true,
  );
});

test("an explicit mode wins over the environment", () => {
  const env = { [COMPATIBILITY_MODE_ENV]: "yes" };
  assert.equal(resolveCompatibilityMode("no", env), "no");
  assert.equal(
    resolveCompatibilityMode("yes", { [COMPATIBILITY_MODE_ENV]: "no" }),
    "yes",
  );
});

test("the environment configures it when nothing is passed", () => {
  assert.equal(
    resolveCompatibilityMode(undefined, { [COMPATIBILITY_MODE_ENV]: "yes" }),
    "yes",
  );
  assert.equal(
    resolveCompatibilityMode(undefined, { [COMPATIBILITY_MODE_ENV]: "no" }),
    "no",
  );
});

test("an empty or whitespace variable is not a configured value", () => {
  for (const value of ["", "   "]) {
    assert.equal(
      resolveCompatibilityMode(undefined, { [COMPATIBILITY_MODE_ENV]: value }),
      "no",
    );
  }
});

test("the spellings an operator is likely to write are accepted", () => {
  for (const value of ["yes", "YES", " Yes ", "true", "1", "on"]) {
    assert.equal(parseCompatibilityMode(value), "yes", value);
  }
  for (const value of ["no", "NO", " No ", "false", "0", "off"]) {
    assert.equal(parseCompatibilityMode(value), "no", value);
  }
});

test("an unrecognised value throws rather than silently defaulting", () => {
  // Reading "enabled" as "no" would turn compatibility off for someone asking
  // for it on, which is the one way this setting must not fail.
  for (const value of ["enabled", "y", "sure", "maybe", "2"]) {
    assert.throws(() => parseCompatibilityMode(value), TypeError, value);
    assert.throws(
      () =>
        resolveCompatibilityMode(undefined, {
          [COMPATIBILITY_MODE_ENV]: value,
        }),
      TypeError,
      value,
    );
  }
});

test("compatibility mode withholds omcp's additions", () => {
  assert.equal(omcpAdditionsEnabled("yes"), false);
  assert.equal(omcpAdditionsEnabled("no"), true);
});

test("incoming omcp elements are ignored, never rejected, in either mode", () => {
  // Rejecting would make an omcp peer fail against a compatibility-mode
  // implementation, which is the interoperability this setting protects.
  assert.equal(INCOMING_ADDITIONS_ARE_IGNORED, true);
});

test("using an addition under compatibility mode fails where it happens", () => {
  assert.doesNotThrow(() => assertAdditionAllowed("attested admission", "no"));
  assert.throws(
    () => assertAdditionAllowed("attested admission", "yes"),
    /attested admission is an omcp addition and compatibility mode is on/,
  );
});

test("the error names the variable an operator has to change", () => {
  assert.throws(
    () => assertAdditionAllowed("audit records", "yes"),
    new RegExp(COMPATIBILITY_MODE_ENV),
  );
});

test("resolution works where there is no process object", () => {
  // Browsers, edge runtimes and some sandboxes have no `process`; a protocol
  // library must fall back to the default rather than throw.
  const saved = globalThis.process;
  try {
    // @ts-expect-error deliberately removing a global to simulate the runtime
    delete globalThis.process;
    assert.equal(resolveCompatibilityMode(), "no");
    assert.equal(resolveCompatibilityMode("yes"), "yes");
  } finally {
    globalThis.process = saved;
  }
});
