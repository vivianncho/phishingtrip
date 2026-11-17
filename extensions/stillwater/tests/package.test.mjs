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
    assert.ok(manifest.web_accessible_resources[0].resources.includes("images/*.svg"),
      "the opt-in extension iframe can load its local artwork");
    const html = await readFile(path.join(dir, "popup.html"), "utf8");
    assert.ok(html.includes('id="consent"'));
    assert.ok(html.includes('type="module" src="popup.js"'));
    assert.ok(html.includes('aria-label="Hook, your fish companion"'));
    assert.ok(html.includes('id="hook-caption"'));
    assert.doesNotMatch(html, /fish-eye-rest/, "Hook stays awake for an official match");
    const country = html.match(/<select id="country"[^>]*>([\s\S]*?)<\/select>/)?.[1];
    assert.ok(country, "country is an explicit picker");
    assert.deepEqual([...country.matchAll(/value="([^"]*)"/g)].map(m => m[1]), ["", "US", "MX", "CA"]);
    assert.ok(!/<(?:script|link|image|img)\b[^>]*(?:src|href)="https?:/i.test(html),
      "popup artwork, styles and scripts are local");
    assert.equal(await readFile(path.join(dir, "settings.js"), "utf8"), 'export const DEFAULT_API_ORIGIN = "";\n');
    for (const file of ["popup.js", "core.js", "view.js", "inline.js", "scan.js"]) {
      execFileSync(process.execPath, ["--check", path.join(dir, file)]);
    }
    for (const size of [16, 32, 48, 128]) {
      const png = await readFile(path.join(dir, `icons/${size}.png`));
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(png.readUInt32BE(16), size);
      assert.equal(png.readUInt32BE(20), size);
    }
    await access(`${dir}.zip`);
    const zipEntries = execFileSync("python3", ["-c", "import zipfile,sys; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", `${dir}.zip`], { encoding: "utf8" });
    assert.ok(zipEntries.split("\n").includes("manifest.json"));
    for (const layer of ["fins", "body", "face", "lantern"]) {
      const name = `images/hook-figma-${layer}.svg`;
      assert.ok(html.includes(`href="${name}"`));
      const svg = await readFile(path.join(dir, name), "utf8");
      const reference = await readFile(path.join(workspace,
        `artifacts/mockup-sandbox/public/${name}`), "utf8");
      assert.equal(svg, reference, "ship the reference artwork, not a substitute");
      assert.doesNotMatch(svg, /<(?:script|foreignObject)\b|(?:href|src)=["']https?:/i);
      assert.ok(zipEntries.split("\n").includes(name), "nested assets survive ZIP packaging");
    }
    const css = await readFile(path.join(dir, "popup.css"), "utf8");
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /--lantern-color:\s*#38c85b/);
    assert.match(css, /--lantern-color:\s*#e53e46/);
    assert.match(css, /\.unverified-warning/);
    for (const state of ["searching", "official_match", "reports_found", "not_verified"]) {
      assert.ok(css.includes(`[data-state=${state}]`), `Hook responds to ${state}`);
    }
  }
});
