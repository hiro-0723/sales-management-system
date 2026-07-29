import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callAppsScriptInternal,
  mapAppsScriptResultToHttp
} from '../src/task-result.js';

test('successful Apps Script result acknowledges the task', () => {
  assert.equal(mapAppsScriptResultToHttp({ ok: true }).status, 200);
});

test('retryable Apps Script result asks Cloud Tasks to retry', () => {
  assert.equal(
    mapAppsScriptResultToHttp({
      ok: false,
      retryable: true,
      code: 'REGISTRATION_FAILED'
    }).status,
    503
  );
});

test('permanent input error acknowledges and stops retries', () => {
  assert.equal(
    mapAppsScriptResultToHttp({
      ok: false,
      retryable: false,
      code: 'SIGNATURE_MISMATCH'
    }).status,
    200
  );
});

test('invalid Apps Script response is retryable', async () => {
  const result = await callAppsScriptInternal({
    url: 'https://example.invalid/exec',
    envelope: {},
    fetchImpl: async () => ({
      text: async () => '<html>temporary error</html>'
    })
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'INVALID_APPS_SCRIPT_RESPONSE');
});
