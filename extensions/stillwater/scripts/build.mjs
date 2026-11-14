import { readFile, writeFile, mkdir, cp, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { apiOrigin } from "../src/core.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const workspace = path.resolve(root, "../..");
const output = path.join(workspace, "generated-artifacts/stillwater-extension");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--api-origin")) {
  throw new Error("Usage: node extensions/stillwater/scripts/build.mjs [--api-origin https://published-backend.example]");
}
const origin = args.length ? apiOrigin(args[1]) : "";
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));

await mkdir(output, { recursive: true });
for (const browser of ["chromium", "safari"]) {
  const target = path.join(output, browser);
  await rm(target, { recursive: true, force: true });
  await mkdir(path.join(target, "icons"), { recursive: true });
  for (const file of await readdir(path.join(root, "src"))) await cp(path.join(root, "src", file), path.join(target, file), { recursive: true });
  await writeFile(path.join(target, "settings.js"), `export const DEFAULT_API_ORIGIN = ${JSON.stringify(origin)};\n`);
  const browserManifest = { ...manifest, ...(browser === "chromium" ? { minimum_chrome_version: "102" } : {}) };
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
console.log(origin ? `Default evidence origin: ${origin}` : "No backend is preconfigured. Install, open Setup, and allow your published HTTPS evidence service.");
