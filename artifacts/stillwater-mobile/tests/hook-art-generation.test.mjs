import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canvasPlacement, generateHookArt, layerNames, nativeLayer, regenerateHookArt } from '../scripts/generate-hook-art.mjs';
import { HOOK_BODY, HOOK_FACE, HOOK_FINS, HOOK_LANTERN, hookXml } from '../components/hookArt.ts';

const canvasPath = new URL('../../mockup-sandbox/src/components/mockups/stillwater/Stillwater.tsx', import.meta.url);
const sourceDir = new URL('../../mockup-sandbox/public/images/', import.meta.url);
const canvas = await readFile(canvasPath, 'utf8');
const sources = Object.fromEntries(await Promise.all(layerNames.map(async name =>
  [name, await readFile(new URL(`hook-figma-${name}.svg`, sourceDir), 'utf8')])));
const bundled = { fins: HOOK_FINS, body: HOOK_BODY, face: HOOK_FACE, lantern: HOOK_LANTERN };

test('checked-in Hook bundle is regenerated exactly from current canvas sources', async () => {
  await regenerateHookArt({ check: true });
  const cli = spawnSync(process.execPath, [
    new URL('../scripts/generate-hook-art.mjs', import.meta.url).pathname, '--check',
  ], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
});

test('every native viewport matches the canvas placement and original SVG viewBox', () => {
  const { viewBox, placements } = canvasPlacement(canvas);
  assert.ok(hookXml([]).includes(`viewBox="${viewBox}"`));
  for (const name of layerNames) {
    const root = bundled[name].match(/^<svg\b[^>]*>/)[0];
    for (const [key, value] of Object.entries(placements[name])) assert.ok(root.includes(`${key}="${value}"`), `${name} ${key}`);
    assert.ok(root.includes(sources[name].match(/viewBox="[^"]*"/)[0]), name);
    // Includes all fill, stroke, stroke-width and stroke-linecap values, not just geometry.
    assert.deepEqual([...bundled[name].matchAll(/<path\b[^>]*>/g)].map(m => m[0]),
      [...sources[name].matchAll(/<path\b[^>]*>/g)].map(m => m[0]));
  }
});

test('source geometry, paint, viewport and canvas placement changes all propagate', () => {
  const baseline = generateHookArt(sources, canvas);
  for (const name of layerNames) {
    for (const [from, to] of [
      ['d="M', 'd="M1 2L'],
      ['fill="#', 'fill="#ABCDEF" data-original="#'],
      ['stroke="#', 'stroke="#ABCDEF" data-original="#'],
      ['stroke-width="', 'stroke-width="9" data-original="'],
      ['viewBox="0 0 ', 'viewBox="1 2 '],
    ]) {
      assert.ok(sources[name].includes(from), `${name}: fixture must change`);
      const modified = { ...sources, [name]: sources[name].replace(from, to) };
      const output = generateHookArt(modified, canvas);
      assert.notEqual(output, baseline, `${name}: ${from}`);
      assert.ok(output.includes(JSON.stringify(nativeLayer(modified[name], canvasPlacement(canvas).placements[name], name))));
    }
    for (const key of ['x', 'y', 'width', 'height']) {
      const movedCanvas = canvas.replace(/<image\b[^>]*>/g, tag => tag.includes(`hook-figma-${name}.svg`)
        ? tag.replace(new RegExp(`${key}="[^"]+"`), `${key}="222"`) : tag);
      const output = generateHookArt(sources, movedCanvas);
      assert.notEqual(output, baseline);
      const line = output.split('\n').find(line => line.startsWith(`export const HOOK_${name.toUpperCase()}`));
      assert.ok(line.includes(`${key}=\\\"222\\\"`), `${name}: ${key}`);
    }
  }
  assert.match(generateHookArt(sources, canvas.replace('viewBox="0 0 480 400"', 'viewBox="0 0 500 420"')),
    /viewBox="0 0 500 420"/);
});

test('lantern filter substitution retains artwork and fingerprints filter revisions', () => {
  const output = generateHookArt(sources, canvas);
  assert.doesNotMatch(HOOK_LANTERN, /<defs|<filter|\sfilter=|<fe[A-Z]/);
  const changed = generateHookArt({ ...sources, lantern: sources.lantern.replace('stdDeviation="11"', 'stdDeviation="12"') }, canvas);
  assert.notEqual(changed, output, 'substituted source changes cannot pass freshness checks unnoticed');
  assert.equal(changed.split('\n').find(line => line.startsWith('export const HOOK_LANTERN')),
    output.split('\n').find(line => line.startsWith('export const HOOK_LANTERN')));
  assert.throws(() => generateHookArt({ ...sources, body: sources.body.replace('<g ', '<g filter="url(#blur)" ') }, canvas),
    /Unsupported browser content/);
});

test('regeneration is byte-idempotent and stale checks never modify output', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hook-art-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = join(directory, 'hookArt.ts');
  const options = { sourceDir: pathToFileURL(`${directory}/`), canvasPath: join(directory, 'canvas.tsx'), outputPath };
  await writeFile(options.canvasPath, canvas);
  for (const name of layerNames) await writeFile(join(directory, `hook-figma-${name}.svg`), sources[name]);
  await assert.rejects(regenerateHookArt({ ...options, check: true }), /artwork is stale/);
  assert.equal(await regenerateHookArt(options), true);
  const first = await readFile(outputPath, 'utf8');
  const before = await stat(outputPath);
  assert.equal(await regenerateHookArt(options), false);
  assert.equal(await readFile(outputPath, 'utf8'), first);
  assert.equal((await stat(outputPath)).mtimeMs, before.mtimeMs, 'unchanged output is not rewritten');
  assert.equal(await regenerateHookArt({ ...options, check: true }), false);
  await writeFile(join(directory, 'hook-figma-body.svg'), sources.body.replace('#123F49', '#123456'));
  await assert.rejects(regenerateHookArt({ ...options, check: true }), /artwork is stale/);
  assert.equal(await readFile(outputPath, 'utf8'), first);
  assert.equal(await regenerateHookArt(options), true);
  assert.notEqual(await readFile(outputPath, 'utf8'), first);
  await regenerateHookArt({ ...options, check: true });
  await writeFile(outputPath, 'manual edit');
  await assert.rejects(regenerateHookArt({ ...options, check: true }), /artwork is stale/);
  assert.equal(await readFile(outputPath, 'utf8'), 'manual edit');
});

test('missing sources and unsupported placement fail instead of keeping stale artwork', async () => {
  assert.throws(() => canvasPlacement(canvas.replace('x="174"', 'x={174}')), /Missing literal x/);
  assert.throws(() => canvasPlacement(canvas.replace('hook-figma-face.svg', 'other.svg')), /Missing canvas layer: face/);
  assert.throws(() => canvasPlacement(canvas.replace('viewBox="0 0 480 400"', 'viewBox="not-a-viewBox"')), /four finite numbers/);
  assert.throws(() => generateHookArt({ ...sources, body: '<svg>broken' }, canvas), /complete SVG root/);
  await assert.rejects(regenerateHookArt({ sourceDir: new URL('./missing/', sourceDir) }), { code: 'ENOENT' });
});
