import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

test("both real extension packages build without background crawling or preconfigured private URLs", async () => {
  const workspace = fileURLToPath(new URL("../../..", import.meta.url));
  execFileSync(process.execPath, ["extensions/stillwater/scripts/build.mjs"], { cwd: workspace });
  for (const target of ["chromium", "safari"]) {
    const dir = path.join(workspace, "generated-artifacts/stillwater-extension", target);
    const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
    assert.equal(manifest.content_scripts, undefined);
    assert.equal(manifest.background, undefined);
    assert.equal(manifest.externally_connectable, undefined);
    assert.equal(manifest.host_permissions, undefined);
    assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"]);
    const html = await readFile(path.join(dir, "popup.html"), "utf8");
    assert.ok(html.includes('id="consent"'));
    assert.ok(html.includes('type="module" src="popup.js"'));
    assert.equal(await readFile(path.join(dir, "settings.js"), "utf8"), 'export const DEFAULT_API_ORIGIN = "";\n');
    for (const file of ["popup.js", "core.js", "view.js", "inline.js", "scan.js"]) {
      execFileSync(process.execPath, ["--check", path.join(dir, file)]);
    }
    const png = await readFile(path.join(dir, "icons/128.png"));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    await access(`${dir}.zip`);
    const zipEntries = execFileSync("python3", ["-c", "import zipfile,sys; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", `${dir}.zip`], { encoding: "utf8" });
    assert.ok(zipEntries.split("\n").includes("manifest.json"));
  }
});
