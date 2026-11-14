import { readFile, writeFile, mkdir, cp, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([length, tag, data, crc]);
}
function icon(size) {
  const rgba = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const X = x / size, Y = y / size;
    const body = ((X - .56) / .31) ** 2 + ((Y - .55) / .24) ** 2 < 1;
    const tail = X > .1 && X < .35 && Math.abs(Y - .55) < (.35 - X) * .8 + .025;
    const eye = ((X - .72) / .035) ** 2 + ((Y - .5) / .045) ** 2 < 1;
    const lantern = (X - .71) ** 2 + (Y - .21) ** 2 < .002;
    const stem = X > .545 && X < .565 && Y > .22 && Y < .35 ||
      Y > .215 && Y < .235 && X > .55 && X < .71;
    const color = eye ? [10, 22, 40] : lantern ? [220, 255, 247] :
      body ? [62, 240 - Math.round(Y * 35), 216] : tail || stem ? [40, 175, 169] : [10, 22, 40];
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    rgba.set([...color, 255], offset);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rgba)), chunk("IEND", Buffer.alloc(0))]);
}

await mkdir(output, { recursive: true });
for (const browser of ["chromium", "safari"]) {
  const target = path.join(output, browser);
  await rm(target, { recursive: true, force: true });
  await mkdir(path.join(target, "icons"), { recursive: true });
  for (const file of await readdir(path.join(root, "src"))) await cp(path.join(root, "src", file), path.join(target, file));
  await writeFile(path.join(target, "settings.js"), `export const DEFAULT_API_ORIGIN = ${JSON.stringify(origin)};\n`);
  const browserManifest = { ...manifest, ...(browser === "chromium" ? { minimum_chrome_version: "102" } : {}) };
  await writeFile(path.join(target, "manifest.json"), JSON.stringify(browserManifest, null, 2) + "\n");
  for (const size of [16, 32, 48, 128]) await writeFile(path.join(target, `icons/${size}.png`), icon(size));
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
