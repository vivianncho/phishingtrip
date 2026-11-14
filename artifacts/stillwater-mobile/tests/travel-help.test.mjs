import test from 'node:test';
import assert from 'node:assert/strict';
import { act, mobile, mount, result, B } from './support/mount.mjs';
import { travelHelpTopic, samePhone } from '../lib/travelHelp.ts';

test('local issue guidance covers flights, baggage, hotels and rentals without classifying scams', () => {
  assert.equal(travelHelpTopic('changing flight time').title, 'Flight or ticket help');
  assert.equal(travelHelpTopic('lost luggage').title, 'Baggage help');
  assert.equal(travelHelpTopic('hotel check in').title, 'Hotel or booking help');
  assert.equal(travelHelpTopic('car pickup').title, 'Rental help');
  assert.equal(travelHelpTopic('train refund').title, 'Travel support');
  assert.equal(samePhone('+1 (202) 555-0199', '+12025550199'), true);
});

async function unverified(h) {
  const check = await h.start();
  await h.resolve(check, result(undefined, { outcome: 'not_verified', label: 'Not verified', reason: 'NO_EVIDENCE' }));
}
async function fill(h, id, value) {
  await act(async () => h.find(id).props.onChangeText(value));
}

test('unverified issue produces sourced options, explicit calls and an opt-in Google search', async t => {
  const h = await mount(t, { directoryContacts: true });
  await unverified(h);
  assert.ok(h.find('travel-help'));
  const before = h.requests.length;
  await fill(h, 'travel-problem', 'Changing flight time PRIVATE_BOOKING');
  assert.equal(h.requests.length, before, 'typing does not send requests');
  assert.equal(h.find('help-company').props.value, 'Delta');
  await h.press('find-help');
  await h.flush();
  assert.match(h.text(), /Flight or ticket help/);
  const lookup = h.requests.find(r => r.url.includes('search=Delta'));
  assert.ok(lookup);
  assert.ok(h.find(`call-${B}`));
  await h.press(`call-${B}`);
  assert.equal(mobile.events.calls.length, 0);
  await h.press(`cancel-call-${B}`);
  assert.equal(mobile.events.calls.length, 0);
  await h.press(`call-${B}`);
  await h.press(`confirm-call-${B}`);
  assert.deepEqual(mobile.events.calls, [`tel:${B}`]);
  await h.press('help-google');
  assert.equal(h.find('places-query').props.value, 'Delta');
  assert.equal(h.posts.length, 1, 'opening Google panel does not spend a lookup');
  await h.press('search-places');
  const google = h.posts.at(-1);
  assert.deepEqual(JSON.parse(google.body), { query: 'Delta' });
  assert.ok(h.requests.every(r => !JSON.stringify({ url: r.url, body: r.body }).includes('PRIVATE_BOOKING')));
  await h.resolve(google, { checkedAt: new Date().toISOString(), items: [
    { id: 'excluded', name: 'Same number', address: '', phone: '+1 800-221-1212', attributions: [] },
    { id: 'option', name: 'Another business listing', address: 'Boston', phone: '+12025550199', attributions: [] },
  ] });
  assert.equal(h.find('check-place-excluded'), undefined);
  assert.ok(h.find('check-place-option'));
  await h.press('check-place-option');
  assert.equal(h.companion.draft.number, '+12025550199');
  assert.equal(h.companion.draft.companyId, '');
  assert.equal(h.posts.length, 2, 'prefill does not submit another check');
  assert.equal(h.find('travel-help'), undefined);
});

test('editing issue or backgrounding removes suggestions and never makes an automatic Google request', async t => {
  const h = await mount(t, { directoryContacts: true });
  await unverified(h);
  await fill(h, 'travel-problem', 'Changing flight time');
  await h.press('find-help'); await h.flush();
  await h.press('help-google');
  await h.press('search-places');
  const pending = h.posts.at(-1);
  await fill(h, 'help-company', 'Different hotel');
  assert.ok(pending.signal.aborted);
  await h.resolve(pending, { checkedAt: new Date().toISOString(), items: [
    { id: 'old', name: 'OLD_STALE_RESULT', address: '', phone: B, attributions: [] },
  ] });
  assert.equal(h.find('check-place-old'), undefined);
  assert.equal(h.find('places-query'), undefined);
  await act(async () => mobile.appState('background'));
  assert.equal(h.find('travel-help'), undefined);
  assert.equal(mobile.events.writes.length, 0);
});

test('the suspect number is not offered again as a sourced call option', async t => {
  const h = await mount(t, { directoryContacts: true });
  const check = await h.start(B);
  await h.resolve(check, result(B, { outcome: 'not_verified', label: 'Not verified', reason: 'SOURCE_CONFLICT' }));
  await fill(h, 'travel-problem', 'Flight change');
  await h.press('find-help'); await h.flush();
  assert.equal(h.find(`call-${B}`), undefined);
  assert.match(h.text(), /No different current phone contact/);
});
