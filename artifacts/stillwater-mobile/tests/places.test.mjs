import test from 'node:test';
import assert from 'node:assert/strict';
import { act, mobile, mount } from './support/mount.mjs';

const query = 'Private hotel search Boston';
const response = {
  checkedAt: '2026-11-14T00:00:00Z',
  items: [{
    id: 'google-example', name: 'Example Hotel', address: 'Boston',
    phone: '+12025550199', mapsUrl: 'https://maps.google.com/?cid=1',
    attributions: [{ name: 'Example attribution', uri: 'https://example.org/' }],
  }],
};
async function enter(h) {
  await h.show(mobile.PlacesSearch);
  await act(async () => h.find('places-query').props.onChangeText(query));
}

test('Google lookup requires one explicit tap and never enters query or mutation caches', async t => {
  const h = await mount(t);
  await enter(h);
  assert.equal(h.posts.length, 0);
  const submit = h.find('search-places').props.onPress;
  await act(async () => { void submit(); void submit(); });
  assert.equal(h.posts.length, 1);
  const post = h.posts[0];
  assert.equal(post.url, '/api/places/search');
  assert.equal(post.cache, 'no-store');
  assert.deepEqual(JSON.parse(post.body), { query });
  assert.ok(!post.url.includes(query));
  await h.resolve(post, response);
  assert.match(h.text(), /Example Hotel|not independently verified/);
  assert.doesNotMatch(h.text(), /Official match/);
  h.assertPrivate();
  assert.doesNotMatch(JSON.stringify(h.client.getQueryCache().getAll()), /Private hotel|google-example/);
  assert.equal(h.client.getMutationCache().getAll().length, 0);
  assert.equal(mobile.events.writes.length, 0);
});

for (const state of ['inactive', 'background']) {
  test(`Google results and search text are discarded on ${state}, including late responses`, async t => {
    const h = await mount(t);
    await enter(h);
    await h.press('search-places');
    const post = h.posts[0];
    await act(async () => mobile.appState(state));
    assert.ok(post.signal.aborted);
    await h.resolve(post, response);
    assert.equal(h.find('places-query').props.value, '');
    assert.equal(h.find('places-results'), undefined);
    await act(async () => mobile.appState('active'));
    assert.equal(h.posts.length, 1);
    h.assertPrivate();
  });
}

test('using a Google phone number fills Check without a verified company claim or automatic check', async t => {
  const h = await mount(t);
  await enter(h);
  await h.press('search-places');
  await h.resolve(h.posts[0], response);
  await h.press('check-place-google-example');
  assert.deepEqual(h.companion.draft, { number: '+12025550199', country: '', companyId: '' });
  assert.equal(h.posts.length, 1);
  assert.deepEqual(mobile.events.routes.at(-1), { method: 'push', destination: '/' });
  assert.equal(h.find('places-results'), undefined);
  assert.equal(mobile.events.writes.length, 0);
});

test('empty listings and service failures do not claim fraud or display raw server messages', async t => {
  const h = await mount(t);
  await enter(h);
  await h.press('search-places');
  await h.resolve(h.posts[0], { items: [], checkedAt: response.checkedAt });
  assert.match(h.text(), /No listing found|not evidence of fraud/);
  await h.press('search-places');
  await act(async () => h.posts[1].httpError(503, { code: 'PLACES_ACCESS_ERROR', message: 'SECRET_DIAGNOSTIC' }));
  assert.match(h.text(), /isn’t set up yet/);
  assert.doesNotMatch(h.text(), /SECRET_DIAGNOSTIC/);
  await h.press('search-places');
  await act(async () => h.posts[2].httpError(429, { code: 'PLACES_DAILY_LIMIT', message: 'SECRET_DIAGNOSTIC' }));
  assert.match(h.text(), /midnight UTC/);
  assert.doesNotMatch(h.text(), /SECRET_DIAGNOSTIC/);
});
