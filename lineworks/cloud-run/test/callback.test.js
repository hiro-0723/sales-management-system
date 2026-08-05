import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeLineWorksSignature,
  handleLineWorksCallback
} from '../src/callback.js';

const BOT_ID = '12871416';
const BOT_SECRET = 'test-only-bot-secret';
const NOW = Date.parse('2026-08-05T06:30:30.000Z');
const EVENT = {
  type: 'message',
  source: {
    userId: 'test-user',
    channelId: 'test-channel',
    domainId: 10175971
  },
  issuedTime: '2026-08-05T06:30:00.000Z',
  content: { type: 'text', text: '地域情報' }
};

function createRequest(overrides = {}) {
  const body = Buffer.from(JSON.stringify(EVENT));
  return {
    body,
    botIdHeader: BOT_ID,
    signatureHeader: computeLineWorksSignature(body, BOT_SECRET),
    expectedBotId: BOT_ID,
    botSecret: BOT_SECRET,
    enqueue: async () => {},
    nowMs: () => NOW,
    ...overrides
  };
}

test('valid text callback is enqueued and acknowledged', async () => {
  const tasks = [];
  const result = await handleLineWorksCallback(createRequest({
    enqueue: async task => tasks.push(task)
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.code, 'ACCEPTED');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].payload.event.content.text, '地域情報');
  assert.match(tasks[0].taskId, /^lw-[a-f0-9]{48}$/);
});

test('invalid signature is rejected without a task', async () => {
  let called = false;
  const result = await handleLineWorksCallback(createRequest({
    signatureHeader: 'invalid',
    enqueue: async () => { called = true; }
  }));
  assert.equal(result.status, 401);
  assert.equal(result.body.code, 'SIGNATURE_MISMATCH');
  assert.equal(called, false);
});

test('unexpected bot ID is rejected without a task', async () => {
  const result = await handleLineWorksCallback(createRequest({
    botIdHeader: '99999999'
  }));
  assert.equal(result.status, 401);
  assert.equal(result.body.code, 'BOT_ID_MISMATCH');
});

test('unsupported message is acknowledged without a task', async () => {
  const body = Buffer.from(JSON.stringify({
    ...EVENT,
    content: { type: 'file', fileId: 'test-file' }
  }));
  let called = false;
  const result = await handleLineWorksCallback(createRequest({
    body,
    signatureHeader: computeLineWorksSignature(body, BOT_SECRET),
    enqueue: async () => { called = true; }
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.code, 'IGNORED_MESSAGE');
  assert.equal(called, false);
});

test('same callback body creates the same task ID', async () => {
  const taskIds = [];
  const request = createRequest({
    enqueue: async task => taskIds.push(task.taskId)
  });
  await handleLineWorksCallback(request);
  await handleLineWorksCallback(request);
  assert.equal(taskIds[0], taskIds[1]);
});

test('stale signed callback is rejected', async () => {
  const body = Buffer.from(JSON.stringify({
    ...EVENT,
    issuedTime: '2026-08-05T06:00:00.000Z'
  }));
  const result = await handleLineWorksCallback(createRequest({
    body,
    signatureHeader: computeLineWorksSignature(body, BOT_SECRET)
  }));
  assert.equal(result.status, 401);
  assert.equal(result.body.code, 'STALE_EVENT');
});

test('invalid text event is rejected without a task', async () => {
  const body = Buffer.from(JSON.stringify({
    ...EVENT,
    source: {},
    content: { type: 'text', text: '' }
  }));
  let called = false;
  const result = await handleLineWorksCallback(createRequest({
    body,
    signatureHeader: computeLineWorksSignature(body, BOT_SECRET),
    enqueue: async () => { called = true; }
  }));
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'INVALID_EVENT');
  assert.equal(called, false);
});
