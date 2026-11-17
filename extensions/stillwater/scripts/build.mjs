import { readFile, writeFile, mkdir, cp, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { apiOrigin } from "../src/core.js";
import { verifyReleaseService } from "./release-service.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const workspace = path.resolve(root, "../..");
const args = process.argv.slice(2);
const release = args.includes("--release");
const options = args.filter(arg => arg !== "--release");
if ((options.length && (options.length !== 2 || options[0] !== "--api-origin")) || args.filter(arg => arg === "--release").length > 1) {
  throw new Error("Usage: node extensions/stillwater/scripts/build.mjs [--release] [--api-origin https://published-backend.example]");
}
const config = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
const candidate = options.length ? options[1] : release ? config.apiOrigin : "";
const origin = release ? await verifyReleaseService(candidate) : candidate ? apiOrigin(candidate) : "";
const output = path.join(workspace, "generated-artifacts/stillwater-extension", ...(release ? ["release"] : []));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));

await mkdir(output, { recursive: true });
for (const browser of ["chromium", "safari"]) {
  const target = path.join(output, browser);
  await rm(target, { recursive: true, force: true });
  await mkdir(path.join(target, "icons"), { recursive: true });
  for (const file of await readdir(path.join(root, "src"))) await cp(path.join(root, "src", file), path.join(target, file), { recursive: true });
  await cp(path.join(workspace, "artifacts/phishing-trip-web/public/images/google-maps-attribution.png"), path.join(target, "images/google-maps-attribution.png"));
  await writeFile(path.join(target, "settings.js"), `export const DEFAULT_API_ORIGIN = ${JSON.stringify(origin)};\nexport const MANAGED_SERVICE = ${release};\n`);
  const browserManifest = { ...manifest, ...(browser === "chromium" ? { minimum_chrome_version: "102" } : {}) };
  if (release) {
    browserManifest.host_permissions = [`${origin}/*`];
    delete browserManifest.optional_host_permissions;
  }
  await writeFile(path.join(target, "manifest.json"), JSON.stringify(browserManifest, null, 2) + "\n");
  // Zip contents, not the enclosing folder: usable by store upload and Apple's packager.
  const archive = path.join(output, `${browser}.zip`);
  await rm(archive, { force: true });
  try {
    execFileSync("python3", ["-c",
      "import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); out=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [out.write(p,p.relative_to(root)) for p in sorted(root.rglob('*')) if p.is_file()]; out.close()",
      target, archive], { stdio: "pipe" });
  } catch { throw new Error(`Extension folder built at ${target}, but creating its ZIP requires Python 3.`); }
}
await cp(path.join(root, "INSTALL.md"), path.join(output, "INSTALL.md"));
console.log("Built Chrome/Edge and Safari extension folders and ZIPs in generated-artifacts/stillwater-extension.");
console.log(release ? `Consumer release: ${origin}; no manual service setup or API keys required.` : "Development packages only. Use --release for a public, preconfigured consumer package. No visibility or store publishing changes were made.");
