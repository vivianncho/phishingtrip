import test from 'node:test';
import assert from 'node:assert/strict';
import { A, B, act, mobile, mount, result } from './support/mount.mjs';

test('typing, country selection, company choice and directory prefill never check automatically', async t => {
  const h = await mount(t);
  await h.type(A);
  await h.press('claim-delta');
  await h.press('choose-country');
  await h.show(mobile.CountryScreen);
  await h.press('country-US');
  await h.show(mobile.CheckScreen);
  assert.equal(h.companion.draft.country, 'US');
  assert.equal(h.posts.length, 0);
  await h.show(mobile.CompanyScreen);
  await h.press('contact-desk');
  await h.show(mobile.CheckScreen);
  assert.deepEqual(h.companion.draft, { number: B, country: '', companyId: 'delta' });
  assert.equal(h.posts.length, 0);
  // An explicit tap without country is rejected locally, not sent.
  await h.press('check-number');
  assert.equal(h.posts.length, 0);
  await h.press('choose-country');
  await h.show(mobile.CountryScreen);
  await h.press('country-international');
  await h.show(mobile.CheckScreen);
  assert.equal(h.posts.length, 0);
  await h.press('check-number');
  assert.deepEqual(JSON.parse(h.posts[0].body), { phoneNumber: B, claimedCompanyId: 'delta' });
  assert.deepEqual(mobile.events.routes, [
    { method: 'push', destination: '/country' }, { method: 'back' },
    { method: 'navigate', destination: '/(tabs)' },
    { method: 'push', destination: '/country' }, { method: 'back' },
  ]);
  h.assertPrivate();
  await h.resolve(h.posts[0], result(B));
});

test('one explicit tap sends only the allowed fields, no-store, and blocks duplicate taps', async t => {
  const h = await mount(t);
  await h.changeDraft({ number: ` ${A} `, country: 'US', companyId: 'delta', url: 'https://private.example', selection: 'private text' });
  const submit = h.find('check-number').props.onPress;
  await act(async () => { void submit(); void submit(); });
  assert.equal(h.posts.length, 1);
  assert.deepEqual(JSON.parse(h.posts[0].body), { phoneNumber: A, defaultCountry: 'US', claimedCompanyId: 'delta' });
  assert.equal(h.posts[0].cache, 'no-store');
  assert.equal(h.posts[0].url, '/api/checks');
  assert.ok(h.posts[0].signal instanceof AbortSignal);
  await h.resolve(h.posts[0], result());
  assert.match(h.text(), /Old A evidence/); // Prove success rendering is actually exercised.
  h.assertPrivate();
  await h.press('open-evidence');
  h.assertPrivate();
  await h.press('close-evidence');
  await h.press('check-another');
  assert.doesNotMatch(h.text(), /Old A evidence|18002211212/);
  await h.changeDraft({ number: B, country: 'international', companyId: '' });
  assert.equal(h.posts.length, 1);
  await h.press('check-number');
  assert.deepEqual(JSON.parse(h.posts[1].body), { phoneNumber: B });
  await h.resolve(h.posts[1], result(B));
});

test('directory selection after pending A fills B only, and ignores late A', async t => {
  const h = await mount(t);
  const a = await h.start();
  await act(async () => mobile.router.navigate('/(tabs)/directory'));
  await h.show(mobile.CompanyScreen);
  await h.press('contact-desk');
  await h.show(mobile.CheckScreen);
  assert.ok(a.signal.aborted);
  assert.equal(h.companion.draft.number, B);
  assert.equal(h.posts.length, 1);
  await h.resolve(a, result());
  assert.equal(h.find('phone-number').props.value, B);
  assert.doesNotMatch(h.text(), /Old A evidence|18002211212/);
  assert.equal(mobile.events.announcements.length, 0);
  h.assertPrivate();
});

test('choosing a result alternative clears evidence and prefills without another POST', async t => {
  const h = await mount(t);
  const a = await h.start();
  await h.resolve(a, result());
  await h.press('contact-desk');
  assert.deepEqual(h.companion.draft, { number: B, country: '', companyId: 'delta' });
  assert.equal(h.posts.length, 1);
  assert.doesNotMatch(h.text(), /Old A evidence|18002211212/);
  await h.press('check-number');
  assert.equal(h.posts.length, 1, 'prefill must still require explicit country selection');
  h.assertPrivate();
});

for (const order of ['A-first', 'B-first']) {
  test(`cancel A, change number and company, start B; ${order} settlement cannot show A`, async t => {
    const h = await mount(t);
    const a = await h.start();
    await h.press('cancel-check');
    assert.ok(a.signal.aborted);
    await h.type(B);
    await h.press('claim-other');
    assert.equal(h.posts.length, 1);
    await h.press('check-number');
    const b = h.posts[1];
    assert.deepEqual(JSON.parse(b.body), { phoneNumber: B, defaultCountry: 'US', claimedCompanyId: 'other' });
    if (order === 'A-first') {
      await h.resolve(a, result());
      assert.ok(h.find('cancel-check'), 'A finally must not unlock or stop B');
      assert.doesNotMatch(h.text(), /Old A evidence|18002211212/);
    }
    await h.resolve(b, result(B, { claimedCompanyId: 'other' }));
    if (order === 'B-first') await h.resolve(a, result());
    assert.match(h.text(), /New B evidence/);
    assert.doesNotMatch(h.text(), /Old A evidence|18002211212/);
    assert.equal(mobile.events.announcements.length, 1);
    assert.match(mobile.events.announcements[0], /New B evidence/);
    h.assertPrivate();
  });
}

test('a late rejection after cancellation cannot replace B with an error', async t => {
  const h = await mount(t);
  const a = await h.start();
  await h.press('cancel-check');
  const b = await h.start(B);
  await h.resolve(b, result(B));
  await act(async () => a.reject(new Error('old transport failure')));
  assert.match(h.text(), /New B evidence/);
  assert.doesNotMatch(h.text(), /No conclusion|old transport failure/);
});

test('country navigation invalidates A even while the check screen remains mounted', async t => {
  const h = await mount(t);
  const a = await h.start();
  await act(async () => mobile.router.push('/country'));
  assert.ok(a.signal.aborted);
  await h.show(mobile.CountryScreen);
  await h.press('country-GB');
  await h.show(mobile.CheckScreen);
  assert.equal(h.posts.length, 1);
  assert.equal(h.companion.draft.country, 'GB');
  await h.press('check-number');
  const b = h.posts[1];
  assert.equal(JSON.parse(b.body).defaultCountry, 'GB');
  await h.resolve(a, result());
  assert.doesNotMatch(h.text(), /Old A evidence/);
  await h.resolve(b, result(A, { label: 'GB selection evidence' }));
  assert.match(h.text(), /GB selection evidence/);
});

test('navigation blur and unmount discard pending results and accessibility announcements', async t => {
  const h = await mount(t);
  const a = await h.start();
  await act(async () => mobile.router.navigate('/(tabs)/directory'));
  assert.ok(a.signal.aborted);
  await h.resolve(a, result());
  assert.doesNotMatch(h.text(), /Old A evidence/);
  assert.equal(mobile.events.announcements.length, 0);
  const another = await h.start();
  await h.show(null);
  assert.ok(another.signal.aborted);
  await h.resolve(another, result());
  await h.show(mobile.CheckScreen);
  assert.doesNotMatch(h.text(), /Old A evidence/);
  assert.equal(mobile.events.announcements.length, 0);
  h.assertPrivate();
});

for (const state of ['inactive', 'background']) {
  test(`${state} clears draft and pending evidence without automatically rechecking on resume`, async t => {
    const h = await mount(t);
    const a = await h.start();
    await act(async () => mobile.appState(state));
    assert.ok(a.signal.aborted);
    assert.deepEqual(h.companion.draft, { number: '', country: '', companyId: '' });
    await act(async () => mobile.appState('active'));
    await h.resolve(a, result());
    assert.doesNotMatch(h.text(), /Old A evidence|18002211212/);
    assert.equal(h.posts.length, 1);
    assert.equal(mobile.events.announcements.length, 0);
    const b = await h.start(B);
    await h.resolve(b, result(B));
    await act(async () => mobile.appState(state));
    assert.doesNotMatch(h.text(), /New B evidence|442079460123/);
    h.assertPrivate();
  });
}

for (const reason of ['COMPANY_MISMATCH', 'NO_EVIDENCE', 'SOURCE_CONFLICT', 'STALE_EVIDENCE']) {
  test(`${reason} renders an uncertain fish, never the reassuring official-match fish`, async t => {
    const h = await mount(t);
    const a = await h.start();
    await h.resolve(a, result(A, { outcome: 'not_verified', reason, label: 'Not verified' }));
    assert.match(h.text(), /Hook the fish. Not sure yet/);
    assert.doesNotMatch(h.text(), /A listed contact, not a guarantee/);
    const eye = h.tree.root.findAll(node => node.type === 'Ellipse');
    assert.ok(eye.some(node => node.props.ry === 13), 'uncertain open eye, not reassuring closed eye');
  });
}

test('unavailable optional providers are not interpreted as reassuring evidence', async t => {
  const h = await mount(t);
  const a = await h.start();
  await h.resolve(a, result(A, {
    outcome: 'not_verified', reason: 'NO_EVIDENCE', label: 'Not verified',
    providers: { directory: 'active', reputation: 'unavailable', metadata: 'unavailable' },
  }));
  assert.match(h.text(), /Hook the fish. Not sure yet/);
  assert.doesNotMatch(h.text(), /A listed contact, not a guarantee/);
});

test('service failure shows no reassuring fish and never exposes server payload', async t => {
  const h = await mount(t);
  const a = await h.start();
  await act(async () => a.httpError(503, { code: 'DIRECTORY_UNAVAILABLE', message: `secret ${A}` }));
  assert.match(h.text(), /No conclusion was reached/);
  assert.doesNotMatch(h.text(), /A listed contact, not a guarantee|secret/);
  assert.equal(mobile.events.announcements.length, 0);
  h.assertPrivate();
});

test('Companion persists only saved company IDs; background and remount lose the private draft', async t => {
  const h = await mount(t);
  await h.start();
  await h.press('cancel-check');
  await act(async () => h.companion.toggleSaved('delta'));
  assert.deepEqual(mobile.events.writes, [['stillwater-saved-company-ids', '["delta"]']]);
  await act(async () => mobile.appState('background'));
  assert.deepEqual(h.companion.savedIds, ['delta']);
  h.assertPrivate();
  // Remount the actual provider as well as the screen.
  await act(async () => h.tree.update(null));
  await h.show(mobile.CheckScreen);
  assert.deepEqual(h.companion.draft, { number: '', country: '', companyId: '' });
  assert.deepEqual(h.companion.savedIds, ['delta']);
  assert.doesNotMatch(h.text(), /Old A evidence|18002211212/);
  assert.equal(h.posts.length, 1);
});
