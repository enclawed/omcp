// Spec Version Warning Banner
// Displays a warning banner on older spec versions and draft pages.
//
// Mintlify automatically loads all .js and .css files in the docs directory,
// and it maintains a /specification/latest/* redirect that always points to
// the current latest version. We use that redirect as the source of truth,
// so this script requires no updates when a new spec version is published.

const DRAFT_VERSION = "draft";
const LATEST_ALIAS_PATH = "/specification/latest";
const SPEC_PATH_REGEX = /\/specification\/([\w-]+)(\/.*)?$/;

function parseSpecPath(pathname) {
  const match = pathname.match(SPEC_PATH_REGEX);
  if (!match) return null;
  return { version: match[1], subPath: match[2] || "" };
}

async function resolveLatestVersion() {
  const cached = sessionStorage.getItem("mcp-latest-spec-version");
  if (cached) return cached;

  const response = await fetch(LATEST_ALIAS_PATH, { method: "HEAD" });
  const resolved = parseSpecPath(new URL(response.url).pathname);
  const version = resolved ? resolved.version : null;

  if (version && version !== "latest") {
    sessionStorage.setItem("mcp-latest-spec-version", version);
  }
  return version;
}

function createWarningBanner(message, linkHref, linkText, isDraft) {
  const banner = document.createElement("div");
  banner.className = isDraft
    ? "spec-version-warning spec-version-warning-draft"
    : "spec-version-warning spec-version-warning-old";
  banner.setAttribute("role", "alert");

  const icon = document.createElement("span");
  icon.className = "spec-version-warning-icon";
  icon.textContent = "⚠️";

  const content = document.createElement("div");
  content.className = "spec-version-warning-content";

  const text = document.createElement("span");
  text.textContent = message + " ";

  const link = document.createElement("a");
  link.href = linkHref;
  link.textContent = linkText;
  link.className = "spec-version-warning-link";

  content.appendChild(text);
  content.appendChild(link);
  banner.appendChild(icon);
  banner.appendChild(content);

  return banner;
}

async function insertWarningBanner() {
  const current = parseSpecPath(window.location.pathname);
  if (!current) return;

  if (document.querySelector(".spec-version-warning")) return;

  const contentArea = document.querySelector(
    "#content-area, main, article, .content",
  );
  if (!contentArea) return;

  const latest = await resolveLatestVersion().catch(() => null);
  if (!latest || current.version === latest) return;

  // Deep-link to the same page in the latest version.
  // Mintlify redirects /specification/latest/<sub-path> to the actual version.
  const latestHref = LATEST_ALIAS_PATH + current.subPath;
  const linkText = `View the latest version (${latest})`;

  const isDraft = current.version === DRAFT_VERSION;
  const message = isDraft
    ? "Warning: You are viewing a draft of a not-yet-finalised specification."
    : `Warning: You are viewing an older version (${current.version}) of the specification.`;

  const banner = createWarningBanner(message, latestHref, linkText, isDraft);
  contentArea.insertBefore(banner, contentArea.firstChild);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", insertWarningBanner);
} else {
  insertWarningBanner();
}

// Re-insert after SPA navigation.
const observer = new MutationObserver(() => {
  if (
    !document.querySelector(".spec-version-warning") &&
    parseSpecPath(window.location.pathname)
  ) {
    insertWarningBanner();
  }
});
observer.observe(document.body, { childList: true, subtree: true });
