const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, 'InternalApi.js'),
  'utf8'
);
const context = vm.createContext({ console, Date, JSON, Number, String });
vm.runInContext(source, context);

const NOW = Date.parse('2026-07-29T10:00:00.000Z');
const SECRET = 'test-only-secret';

function createEnvelope(overrides = {}) {
  const envelope = {
    version: 1,
    requestId: 'req-20260729-0001',
    issuedAt: '2026-07-29T09:59:00.000Z',
    expiresAt: '2026-07-29T10:04:00.000Z',
    payload: {
      sourceSystem: 'lineworks',
      sourceEventKey: 'event-0001',
      actorExternalId: 'user-0001',
      actorInternalName: 'テスト担当',
      payloadType: 'regionInfo',
      data: {
        department: '本部',
        category: '地域動向',
        content: 'テスト用の地域情報です。',
        relatedParty: 'テスト包括',
        priority: '中',
        salesAction: '判断を任せる'
      }
    },
    ...overrides
  };
  const signed = context.canonicalizeSalesLineWorksValue_(
    context.removeSalesLineWorksSignature_(envelope)
  );
  envelope.signature = crypto
    .createHmac('sha256', SECRET)
    .update(signed)
    .digest('base64');
  return envelope;
}

function createDependencies(state = {}) {
  state.receipts ||= new Map();
  state.regionIds ||= new Set();
  state.records ||= [];
  return {
    nowMs: () => NOW,
    getInternalSecret: () => SECRET,
    computeHmacBase64: (value, secret) =>
      crypto.createHmac('sha256', secret).update(value).digest('base64'),
    acquireLock: () => ({ release() {} }),
    createRegionInfoId: () => 'REG-20260729185900-ABCDEF12',
    beginRequest: (requestId, regionInfoId) => {
      const existing = state.receipts.get(requestId);
      if (existing) return { ...existing, existed: true };
      const receipt = { regionInfoId, status: 'PROCESSING' };
      state.receipts.set(requestId, receipt);
      return { ...receipt, existed: false };
    },
    regionInfoExists: regionInfoId => state.regionIds.has(regionInfoId),
    appendRegionInfo: record => {
      state.records.push(record);
      state.regionIds.add(record.regionInfoId);
    },
    completeRequest: requestId => {
      state.receipts.get(requestId).status = 'COMPLETE';
    },
    logError() {}
  };
}

test('valid signed request registers one region record', () => {
  const state = {};
  const result = context.handleSalesLineWorksInternalRequest_(
    JSON.stringify(createEnvelope()),
    createDependencies(state)
  );
  assert.equal(result.ok, true);
  assert.equal(result.code, 'REGISTERED');
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].content, 'テスト用の地域情報です。');
});

test('duplicate request returns the original result without another row', () => {
  const state = {};
  const deps = createDependencies(state);
  const body = JSON.stringify(createEnvelope());
  context.handleSalesLineWorksInternalRequest_(body, deps);
  const second = context.handleSalesLineWorksInternalRequest_(body, deps);
  assert.equal(second.ok, true);
  assert.equal(second.code, 'ALREADY_PROCESSED');
  assert.equal(state.records.length, 1);
});

test('processing receipt recovers without duplicating an existing row', () => {
  const state = {
    receipts: new Map([[
      'req-20260729-0001',
      {
        regionInfoId: 'REG-20260729185900-ABCDEF12',
        status: 'PROCESSING'
      }
    ]]),
    regionIds: new Set(['REG-20260729185900-ABCDEF12']),
    records: []
  };
  const result = context.handleSalesLineWorksInternalRequest_(
    JSON.stringify(createEnvelope()),
    createDependencies(state)
  );
  assert.equal(result.ok, true);
  assert.equal(state.records.length, 0);
  assert.equal(state.receipts.get('req-20260729-0001').status, 'COMPLETE');
});

test('invalid signature is rejected permanently', () => {
  const envelope = createEnvelope();
  envelope.signature = 'invalid';
  const result = context.handleSalesLineWorksInternalRequest_(
    JSON.stringify(envelope),
    createDependencies({})
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { ok: false, retryable: false, code: 'SIGNATURE_MISMATCH' }
  );
});

test('expired request is rejected permanently', () => {
  const envelope = createEnvelope({
    issuedAt: '2026-07-29T09:00:00.000Z',
    expiresAt: '2026-07-29T09:05:00.000Z'
  });
  const result = context.handleSalesLineWorksInternalRequest_(
    JSON.stringify(envelope),
    createDependencies({})
  );
  assert.equal(result.code, 'EXPIRED');
  assert.equal(result.retryable, false);
});

test('registration failure is marked retryable', () => {
  const deps = createDependencies({});
  deps.appendRegionInfo = () => {
    throw new Error('temporary sheet error');
  };
  const result = context.handleSalesLineWorksInternalRequest_(
    JSON.stringify(createEnvelope()),
    deps
  );
  assert.equal(result.code, 'REGISTRATION_FAILED');
  assert.equal(result.retryable, true);
});
