// Generates the native iOS container + Safari extension targets using Apple's tool.
// No signing credentials, provisioning profiles or Expo plugins are involved.
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function packageArguments(resources, destination, bundleId) {
  if (!/^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*){2,}$/.test(bundleId)) {
    throw new Error("Supply your own reverse-DNS bundle identifier, such as com.company.Stillwater.");
  }
  return ["safari-web-extension-packager", resources, "--project-location", destination,
    "--app-name", "Stillwater", "--bundle-identifier", bundleId,
    "--swift", "--ios-only", "--copy-resources", "--no-open", "--no-prompt"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("Usage: node extensions/stillwater/scripts/package-safari.mjs com.company.Stillwater");
  const workspace = fileURLToPath(new URL("../../..", import.meta.url));
  const resources = path.join(workspace, "generated-artifacts/stillwater-extension/safari");
  const destination = path.join(workspace, "generated-artifacts/stillwater-safari-native");
  const command = packageArguments(resources, destination, args[0]);
  if (process.platform !== "darwin") {
    throw new Error("Native Xcode packaging requires a Mac with Xcode. On this host use safari.zip with Apple's App Store Connect Safari Web Extension Packager. Expo Go cannot install it.");
  }
  await access(path.join(resources, "manifest.json"));
  let exists = false;
  try { await access(destination); exists = true; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) throw new Error("The native output directory already exists. Move it aside before generating a new project; existing native work will not be overwritten.");
  // The Apple tool will refuse existing projects; never pass --force.
  const child = spawnSync("xcrun", command, { stdio: "inherit" });
  if (child.error || child.status !== 0) throw new Error("Apple packaging failed. Check Xcode installation and manifest compatibility warnings; no signed build was produced.");
  console.log(`Native iOS project generated at ${destination}. Review warnings, select your Apple team for both targets, then build and test on a device. Nothing was signed or uploaded by this script.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
