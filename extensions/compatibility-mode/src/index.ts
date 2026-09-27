/**
 * omcp compatibility mode.
 *
 * omcp is a superset of the Model Context Protocol: everything it adds is
 * additive, so an MCP implementation interoperates with it untouched. This
 * setting is the other direction — it lets an operator hold an omcp
 * implementation to MCP-defined behaviour only, and decide for themselves when
 * to take what omcp adds.
 *
 * Nothing here is on the wire. Compatibility mode is a local decision about
 * what an implementation uses, not something negotiated with a peer.
 */

/** `"no"` (the default) leaves omcp's additions available; `"yes"` withholds them. */
export type CompatibilityMode = "no" | "yes";

export const DEFAULT_COMPATIBILITY_MODE: CompatibilityMode = "no";

/** Environment variable consulted when no mode is passed explicitly. */
export const COMPATIBILITY_MODE_ENV = "OMCP_COMPATIBILITY_MODE";

/**
 * The ambient environment, or an empty one.
 *
 * `process` is absent in browsers, edge runtimes, and some sandboxes. Reading it
 * unguarded would make a protocol library throw where it should simply fall back
 * to the default.
 */
function ambientEnv(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

const TRUTHY = new Set(["yes", "true", "1", "on"]);
const FALSY = new Set(["no", "false", "0", "off"]);

/**
 * Parses a configured value.
 *
 * An unrecognised value throws rather than falling back to a default: silently
 * reading "y" or "enabled" as "no" would turn compatibility off for an operator
 * who was asking for it on, which is the one failure this setting must not have.
 */
export function parseCompatibilityMode(value: string): CompatibilityMode {
  const normalized = value.trim().toLowerCase();
  if (TRUTHY.has(normalized)) return "yes";
  if (FALSY.has(normalized)) return "no";
  throw new TypeError(
    `invalid ${COMPATIBILITY_MODE_ENV}: ${JSON.stringify(value)} — expected one of ${[...FALSY, ...TRUTHY].join(", ")}`,
  );
}

/**
 * Resolves the mode: an explicit argument wins, then the environment, then the
 * default. An empty or absent environment variable is not a configured value.
 */
export function resolveCompatibilityMode(
  explicit?: CompatibilityMode,
  env: Record<string, string | undefined> = ambientEnv(),
): CompatibilityMode {
  if (explicit !== undefined) return explicit;
  const configured = env[COMPATIBILITY_MODE_ENV];
  if (configured === undefined || configured.trim() === "")
    return DEFAULT_COMPATIBILITY_MODE;
  return parseCompatibilityMode(configured);
}

/** Whether omcp's additions may be advertised, requested, or emitted. */
export function omcpAdditionsEnabled(mode: CompatibilityMode): boolean {
  return mode === "no";
}

/**
 * Whether an omcp-specific element arriving from a peer is ignored rather than
 * treated as an error. True in both modes, which is why it is a constant.
 *
 * Compatibility mode restricts what this implementation *does*, not what it
 * tolerates. Ignoring what one does not understand is the rule MCP already
 * applies to unknown fields, and rejecting instead would make an omcp peer fail
 * against a compatibility-mode implementation — precisely the interoperability
 * this setting exists to protect.
 */
export const INCOMING_ADDITIONS_ARE_IGNORED = true;

/**
 * Guard for the entry point of an omcp addition.
 *
 * Throws when an addition is used while compatibility mode is on, so a
 * misconfiguration surfaces where it happens rather than as unexplained traffic.
 */
export function assertAdditionAllowed(
  addition: string,
  mode: CompatibilityMode,
): void {
  if (!omcpAdditionsEnabled(mode)) {
    throw new Error(
      `${addition} is an omcp addition and compatibility mode is on; ` +
        `set ${COMPATIBILITY_MODE_ENV}=no to use it`,
    );
  }
}
