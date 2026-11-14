import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCheckInput, fishCaption, problemText, INTERNATIONAL } from '../lib/checks.ts';

test('country selection is always explicit, including international input', () => {
  assert.throws(() => makeCheckInput('+18002211212', ''), /Choose/);
  assert.throws(() => makeCheckInput('8002211212', INTERNATIONAL), /International/);
  assert.throws(() => makeCheckInput('8002211212', 'ZZ'), /supported/);
  assert.deepEqual(makeCheckInput('800-221-1212', 'US', 'delta'), {
    phoneNumber: '800-221-1212', defaultCountry: 'US', claimedCompanyId: 'delta',
  });
});
test('only the three allowed fields can leave the form', () => {
  assert.deepEqual(makeCheckInput(' +18002211212 ', INTERNATIONAL), { phoneNumber: '+18002211212' });
  for (const value of ['https://site.example/8002211212', 'Call 8002211212', '8002211212 ext 1', '800, 900', '800;900', '123\nhttps://site.example']) {
    assert.throws(() => makeCheckInput(value, 'US'));
  }
});
test('uncertain fish never treats missing or conflicting evidence as reassurance', () => {
  for (const reason of ['NO_EVIDENCE', 'COMPANY_MISMATCH', 'SOURCE_CONFLICT', 'STALE_EVIDENCE']) {
    assert.match(fishCaption({ outcome: 'not_verified', reason }, false), /Not sure/);
  }
  assert.match(fishCaption({ outcome: 'reports_found' }, false), /Pause/);
  assert.match(fishCaption({ outcome: 'official_match' }, false), /not a guarantee/);
});
test('errors are fixed copy, not a server payload or submitted number', () => {
  assert.doesNotMatch(problemText({ message: '+18002211212', data: { message: '+18002211212' } }), /18002211212/);
  assert.match(problemText({ status: 429, headers: new Headers({ 'Retry-After': '30' }) }), /30 seconds/);
  assert.match(problemText({ data: { code: 'DIRECTORY_UNAVAILABLE' } }), /No conclusion/);
});
