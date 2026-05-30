import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LANDING = path.join(ROOT, "apps", "landing");
const APP_DIR = path.join(LANDING, "app");

const SCAN_DIRS = [
  path.join(LANDING, "app"),
  path.join(LANDING, "components"),
  path.join(LANDING, "lib"),
];

const allowedExternalHosts = [
  "ambulantplus.co.za",
  "www.ambulantplus.co.za",
  "patient.ambulantplus.co.za",
  "clinician.ambulantplus.co.za",
  "careport.ambulantplus.co.za",
  "medreach.ambulantplus.co.za",
  "clients.ambulantplus.co.za",
  "admin.ambulantplus.co.za",
  "cloventechnology.com",
  "www.cloventechnology.com",
  "ambulant.cloventechnology.com",
  "duecare.cloventechnology.com",
  "nexring.cloventechnology.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
];

const ignoredPrefixes = [
  "#",
  "mailto:",
  "tel:",
  "javascript:",
];

const ignoredInternalPrefixes = [
  "/api/",
  "/_next/",
  "/brand/",
  "/og/",
  "/visuals/",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return walk(full);
    if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) return [];

    return [full];
  });
}

function routeFromPage(file) {
  const rel = path.relative(APP_DIR, file).replaceAll("\\", "/");

  // Root app route: apps/landing/app/page.tsx => /
  if (rel === "page.tsx" || rel === "page.ts") return "/";

  // App Router pages and metadata routes
  if (
    !rel.endsWith("/page.tsx") &&
    !rel.endsWith("/page.ts") &&
    !rel.endsWith("/route.ts")
  ) {
    return null;
  }

  let route =
    "/" +
    rel
      .replace(/\/page\.tsx?$/, "")
      .replace(/\/route\.ts$/, "")
      .replace(/\/\(.*?\)/g, "");

  route = route.replace(/\/index$/, "");
  route = route.replace(/\/$/, "");

  return route || "/";
}

function extractLinks(content) {
  const links = new Set();

  const patterns = [
    /href=\{?["'`]([^"'`{}]+)["'`]\}?/g,
    /src=\{?["'`]([^"'`{}]+)["'`]\}?/g,
    /(?:href|url|imageSrc|image|src):\s*["'`]([^"'`]+)["'`]/g,
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(content))) {
      if (match[1]) links.add(match[1]);
    }
  }

  return [...links];
}

const routeFiles = walk(APP_DIR);

const routes = new Set(
  routeFiles
    .map(routeFromPage)
    .filter(Boolean)
    .filter((route) => !route.includes("["))
);

const files = SCAN_DIRS.flatMap(walk);
const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const links = extractLinks(content);

  for (const raw of links) {
    const link = raw.trim();

    if (!link) continue;
    if (ignoredPrefixes.some((prefix) => link.startsWith(prefix))) continue;

    if (link.startsWith("http://") || link.startsWith("https://")) {
      try {
        const host = new URL(link).host;

        if (!allowedExternalHosts.includes(host)) {
          findings.push({
            type: "EXTERNAL_HOST_NOT_WHITELISTED",
            file,
            link,
          });
        }
      } catch {
        findings.push({
          type: "INVALID_EXTERNAL_URL",
          file,
          link,
        });
      }

      continue;
    }

    if (link.startsWith("/")) {
      if (ignoredInternalPrefixes.some((prefix) => link.startsWith(prefix))) {
        continue;
      }

      const clean = link.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";

      if (!routes.has(clean)) {
        findings.push({
          type: "INTERNAL_ROUTE_NOT_FOUND",
          file,
          link,
          clean,
        });
      }
    }
  }
}

console.log("\nKnown routes:");
console.log([...routes].sort().join("\n"));

if (findings.length === 0) {
  console.log(
    "\n✅ Link audit passed. No obvious broken internal routes or unapproved external hosts found.\n"
  );
  process.exit(0);
}

console.log("\n❌ Link audit found issues:\n");

for (const item of findings) {
  console.log(`[${item.type}]`);
  console.log(`File: ${path.relative(ROOT, item.file)}`);
  console.log(`Link: ${item.link}`);

  if (item.clean) {
    console.log(`Resolved route: ${item.clean}`);
  }

  console.log("");
}

process.exit(1);