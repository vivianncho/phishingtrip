import React from 'react';
import { act, create } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
// Use the same CJS entry as the bundled generated client, not a second ESM
// instance with a different React Query context.
const { QueryClient, QueryClientProvider } = await import(pathToFileURL(require.resolve('@tanstack/react-query')).href);
const app = fileURLToPath(new URL('../../', import.meta.url));
const native = `${app}tests/support/native.jsx`;
const nativeImports = new Set([
  'react-native', 'expo-router', 'expo-haptics', '@expo/vector-icons',
  '@react-native-async-storage/async-storage', 'react-native-svg',
]);
const compiled = await build({
  stdin: {
    contents: `
      export { default as CheckScreen } from './app/(tabs)/index';
      export { default as CountryScreen } from './app/country';
      export { default as CompanyScreen } from './app/company/[id]';
      export { CompanionProvider, useCompanion } from './context/Companion';
      export { Hook } from './components/Hook';
      export { PlacesSearch } from './components/PlacesSearch';
      export * from './tests/support/native';
    `,
    resolveDir: app,
    loader: 'tsx',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.png': 'dataurl' },
  plugins: [{
    name: 'native-boundaries',
    setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => {
        if (nativeImports.has(path) || /(?:components\/Ocean|hooks\/useColors)$/.test(path) || path === './Ocean') {
          return { path, namespace: 'native-boundary' };
        }
        if (path === 'react' || path.startsWith('react/') || path === '@tanstack/react-query') {
          return { path: pathToFileURL(require.resolve(path)).href, external: true };
        }
      });
      builder.onLoad({ filter: /.*/, namespace: 'native-boundary' }, ({ path }) => ({
        contents: `export * from ${JSON.stringify(native)};
          export { ${path === 'react-native-svg' ? 'Svg' : 'storage'} as default } from ${JSON.stringify(native)};`,
        loader: 'js', resolveDir: app,
      }));
    },
  }],
});
const outputRoot = fileURLToPath(new URL('../../../../generated-artifacts/', import.meta.url));
await mkdir(outputRoot, { recursive: true });
const outputDir = await mkdtemp(`${outputRoot}mobile-lifecycle-`);
let mobile;
try {
  await writeFile(`${outputDir}/mobile.mjs`, compiled.outputFiles[0].text);
  mobile = await import(pathToFileURL(`${outputDir}/mobile.mjs`).href);
} finally {
  await rm(outputDir, { recursive: true, force: true });
}
export { mobile };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
export { act };

export const A = '+18002211212', B = '+442079460123';
export const contact = {
  id: 'desk', number: B, companyId: 'delta', freshness: 'current',
  region: 'GB', service: 'Reservations', sources: [],
};
const providers = { directory: 'active', reputation: 'unavailable', metadata: 'disabled' };
const company = { id: 'delta', name: 'Delta', category: 'airline', website: 'https://example.test', contacts: [contact] };
export function result(number = A, overrides = {}) {
  return {
    normalizedNumber: number, outcome: 'official_match', reason: 'EXACT_OFFICIAL_MATCH',
    label: 'Official match',
    explanation: `${number === A ? 'Old A evidence' : 'New B evidence'}. Listed contact, not caller authentication.`, countryCode: 'US',
    checkedAt: '2026-11-14T00:00:00Z', freshness: 'current', claimedCompanyId: 'delta',
    providers, metadata: null, alternatives: [contact], evidence: [], limitations: [], ...overrides,
  };
}
export async function mount(t, { directoryContacts = false } = {}) {
  mobile.reset();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    const entry = { url: String(url), ...init };
    requests.push(entry);
    if (init.method === 'POST') {
      // Deliberately ignore AbortSignal: correctness must not depend on the
      // transport/server honoring cancellation, or on promise settlement order.
      return new Promise((resolve, reject) => {
        entry.resolve = data => resolve(Response.json(data));
        entry.reject = reject;
        entry.httpError = (status, data) => resolve(Response.json(data, { status }));
      });
    }
    if (entry.url.includes('/capabilities')) return Response.json({
      providers, checkedAt: '2026-11-14T00:00:00Z', limitations: [],
      reputationReportsAvailable: false, sourceMaxAgeDays: 90,
      metadataCacheTtlSeconds: 3600, metadataCacheMaxEntries: 100,
    });
    if (/\/companies\/delta/.test(entry.url)) {
      return Response.json(company);
    }
    return Response.json({
      items: [{ ...company, contacts: Array.isArray(directoryContacts) ? directoryContacts : directoryContacts ? [contact] : [] }, { ...company, id: 'other', name: 'Other', contacts: [] }],
      total: 2, limit: 50, offset: 0, nextOffset: null,
    });
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let companion, tree;
  function Probe() { companion = mobile.useCompanion(); return null; }
  function render(Screen) {
    return React.createElement(QueryClientProvider, { client },
      React.createElement(mobile.CompanionProvider, null,
        React.createElement(Probe), Screen && React.createElement(Screen)));
  }
  async function flush() {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  }
  await act(async () => { tree = create(render(mobile.CheckScreen)); });
  await flush();
  t.after(async () => {
    await act(async () => tree.unmount());
    await act(async () => {
      for (const request of requests) request.resolve?.(result());
    });
    client.clear();
    globalThis.fetch = originalFetch;
    assert.equal(mobile.events.app.size, 0, 'AppState subscriptions must be removed');
    assert.equal(mobile.events.focus.size, 0, 'focus cleanup must be removed');
  });
  const find = id => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === id)[0];
  const h = {
    tree, client, requests, find, flush,
    get companion() { return companion; },
    get posts() { return requests.filter(request => request.method === 'POST'); },
    text: () => JSON.stringify(tree.toJSON()),
    async changeDraft(value) { await act(async () => companion.setDraft(value)); },
    async type(value) { await act(async () => find('phone-number').props.onChangeText(value)); },
    async press(id) {
      const node = find(id);
      assert.ok(node, `Missing control ${id}`);
      assert.ok(!node.props.disabled, `${id} is disabled`);
      await act(async () => { node.props.onPress(); });
    },
    async show(Screen) {
      await act(async () => tree.update(render(Screen)));
      await flush();
    },
    async resolve(request, data) { await act(async () => request.resolve(data)); },
    async start(number = A) {
      await h.changeDraft({ number, country: 'US', companyId: 'delta' });
      await h.press('check-number');
      return h.posts.at(-1);
    },
    assertPrivate() {
      // Public directory data is intentionally cacheable. Only the submitted
      // number / check result must stay out of both query and mutation caches.
      const queries = client.getQueryCache().getAll();
      assert.ok(queries.length > 0, 'inspect a populated real QueryClient');
      const privateState = JSON.stringify({
        queries: queries.map(query => ({ key: query.queryKey, state: query.state })),
        mutations: client.getMutationCache().getAll().map(mutation => mutation.state),
        routes: mobile.events.routes, writes: mobile.events.writes,
      });
      assert.doesNotMatch(privateState, /18002211212|Old A evidence|New B evidence|normalizedNumber/);
      const nonPublicState = JSON.stringify({
        keys: queries.map(query => query.queryKey),
        routes: mobile.events.routes, writes: mobile.events.writes,
      });
      assert.doesNotMatch(nonPublicState, /18002211212|442079460123|phoneNumber|checkedAt|explanation/);
      assert.equal(client.getMutationCache().getAll().length, 0);
      for (const request of requests) assert.doesNotMatch(request.url, /18002211212|442079460123/);
    },
  };
  return h;
}
