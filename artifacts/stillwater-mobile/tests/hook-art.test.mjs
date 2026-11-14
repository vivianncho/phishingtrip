import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { create } from 'react-test-renderer';
import { act, mobile } from './support/mount.mjs';
import { HOOK_BODY, HOOK_FACE, HOOK_FINS, HOOK_LANTERN, hookXml } from '../components/hookArt.ts';
import { nativeHookXml } from '../components/nativeHookXml.ts';

test('native layers preserve source positions without nested clipping viewports', () => {
  const layers = [HOOK_FINS, HOOK_BODY, HOOK_FACE, HOOK_LANTERN];
  const xml = nativeHookXml(layers);
  assert.equal([...xml.matchAll(/<svg\b/g)].length, 1);
  for (const position of ['174 101', '77.245 134.627', '87 160.5', '40.904 44.917']) {
    assert.ok(xml.includes(`translate(${position}) scale(1 1)`));
  }
  assert.deepEqual([...xml.matchAll(/<path\b[^>]*>/g)].map(m => m[0]),
    layers.flatMap(layer => [...layer.matchAll(/<path\b[^>]*>/g)].map(m => m[0])));
});

test('bundled native artwork preserves every approved path and has no external asset references', async () => {
  for (const [name, xml] of Object.entries({ body: HOOK_BODY, face: HOOK_FACE, fins: HOOK_FINS, lantern: HOOK_LANTERN })) {
    const source = await readFile(new URL(`../../mockup-sandbox/public/images/hook-figma-${name}.svg`, import.meta.url), 'utf8');
    assert.deepEqual([...xml.matchAll(/<path\b[^>]*>/g)].map(m => m[0]),
      [...source.matchAll(/<path\b[^>]*>/g)].map(m => m[0]));
    assert.doesNotMatch(xml, /(?:href=|<image\b|<filter\b|filter=|style=)/);
  }
  const xml = hookXml([HOOK_FINS, HOOK_BODY, HOOK_FACE, HOOK_LANTERN]);
  assert.match(xml, /viewBox="0 0 480 400"/);
  assert.match(xml, /x="77.245" y="134.627"/);
  assert.match(xml, /x="87" y="160.5"/);
});

test('Hook keeps its real captions and distinct evidence reactions', async t => {
  let tree;
  await act(async () => { tree = create(React.createElement(mobile.Hook, { result: null, pending: false })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const paths = () => tree.root.findAllByType('Path').map(node => node.props.d);
  const caption = () => tree.root.findAllByType('Text').at(-1).props.children;
  assert.equal(caption(), 'One step at a time. Hook is here with you.');
  assert.equal(tree.root.findAllByType('SvgXml').length, 3);
  for (const [outcome, pending, expected, reaction] of [
    ['official_match', false, 'A listed contact, not a guarantee. Take your time.', 'M122 209q21 17 42-2'],
    ['not_verified', false, 'Not sure yet. You still have a next step.', 'M128 168q15-8 30 2'],
    ['reports_found', false, 'Pause before calling. There’s another way to get help.', 'M62 6v65c0 24-29 26-29 7v-9l9 9'],
    [null, true, 'Hook is checking the available evidence…', 'M61 186q-14 24 0 48m-15-62q-23 37 0 76'],
  ]) {
    await act(async () => tree.update(React.createElement(mobile.Hook, {
      result: outcome ? { outcome } : null, pending,
    })));
    assert.equal(caption(), expected);
    assert.ok(paths().includes(reaction));
    if (outcome !== 'official_match') assert.ok(!paths().includes('M122 209q21 17 42-2'));
    assert.equal(tree.root.findByProps({ accessible: true }).props.accessibilityLabel, `Hook the fish. ${expected}`);
  }
});

test('Hook responds to live Reduce Motion changes and cleans up its animation', async () => {
  const originalInfo = { ...mobile.AccessibilityInfo };
  const originalAnimated = { ...mobile.Animated };
  const durations = [];
  let listener, removed = false, starts = 0, stops = 0, tree;
  Object.assign(mobile.AccessibilityInfo, {
    isReduceMotionEnabled: async () => false,
    addEventListener: (event, callback) => {
      assert.equal(event, 'reduceMotionChanged');
      listener = callback;
      return { remove() { removed = true; } };
    },
  });
  Object.assign(mobile.Animated, {
    timing: (_, options) => { durations.push(options.duration); return options; },
    sequence: steps => steps,
    loop: () => ({ start() { starts++; }, stop() { stops++; } }),
  });
  try {
    await act(async () => { tree = create(React.createElement(mobile.Hook, { result: null, pending: false })); });
    assert.equal(starts, 1);
    assert.deepEqual(durations, [2200, 2200]);
    await act(async () => tree.update(React.createElement(mobile.Hook, { result: null, pending: true })));
    assert.equal(stops, 1);
    assert.deepEqual(durations.slice(-2), [650, 650]);
    await act(async () => listener(true));
    assert.equal(starts, 2, 'Reduce Motion does not start another loop');
    assert.equal(stops, 2, 'existing loop stops immediately');
    await act(async () => tree.unmount());
    tree = null;
    assert.ok(removed);
  } finally {
    if (tree) await act(async () => tree.unmount());
    Object.assign(mobile.AccessibilityInfo, originalInfo);
    // Remove methods added only by this test.
    for (const key of ['timing', 'sequence', 'loop']) delete mobile.Animated[key];
    Object.assign(mobile.Animated, originalAnimated);
  }
});

test('Hook turns red for reports, green for official matches, and neutral while uncertain or checking', async t => {
  let tree;
  await act(async () => { tree = create(React.createElement(mobile.Hook, { result: null, pending: false })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const layers = () => tree.root.findAllByType('SvgXml').map(node => node.props.xml);
  const neutral = layers();
  const geometry = xml => [...xml.matchAll(/\bd="([^"]*)"/g)].map(match => match[1]);
  for (const [outcome, pending, dominantChannel] of [
    ['reports_found', false, 0],
    ['official_match', false, 1],
    ['not_verified', false, null],
    ['reports_found', true, null],
    ['official_match', true, null],
    [null, false, null],
  ]) {
    await act(async () => tree.update(React.createElement(mobile.Hook, { result: outcome ? { outcome } : null, pending })));
    const rendered = layers();
    assert.deepEqual(rendered.map(geometry), neutral.map(geometry), 'recoloring cannot change approved geometry');
    if (dominantChannel === null) {
      assert.deepEqual(rendered, neutral, 'unknown, reset and pending states must not imply a verdict');
    } else {
      assert.notDeepEqual(rendered, neutral);
      // Face details remain legible; every fin, body and lantern paint changes.
      const paintedLayers = [rendered[0], rendered[1].replace(/<g id="face">[\s\S]*?<\/g>/, ''), rendered[2]];
      for (const xml of paintedLayers) {
        const paints = [...xml.matchAll(/\b(?:fill|stroke)="#([0-9a-f]{6})"/gi)];
        assert.ok(paints.length);
        for (const [, hex] of paints) {
          const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
          assert.ok(rgb[dominantChannel] > rgb[(dominantChannel + 1) % 3]);
          assert.ok(rgb[dominantChannel] > rgb[(dominantChannel + 2) % 3]);
        }
      }
      const glows = tree.root.findAllByType('Circle');
      assert.equal(glows.length, 2);
      assert.equal(glows[0].props.fill, dominantChannel === 0 ? '#e53e46' : '#38c85b');
    }
    if (pending) {
      assert.ok(!tree.root.findAllByType('Path').some(node => ['M122 209q21 17 42-2', 'M62 6v65c0 24-29 26-29 7v-9l9 9'].includes(node.props.d)));
    }
  }
});
