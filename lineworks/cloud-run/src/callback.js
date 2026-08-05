import crypto from 'node:crypto';

const ALLOWED_EVENT_TYPES = new Set(['message']);
const ALLOWED_MESSAGE_TYPES = new Set(['text']);
const MAX_EVENT_AGE_MS = 10 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;
const MAX_TEXT_LENGTH = 2000;

export function computeLineWorksSignature(body, botSecret) {
  return crypto
    .createHmac('sha256', botSecret)
    .update(body)
    .digest('base64');
}

export function signaturesMatch(actual, expected) {
  if (typeof actual !== 'string' || !actual) return false;
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(actualBytes, expectedBytes);
}

export function createCallbackTaskId(botId, body) {
  return 'lw-' + crypto
    .createHash('sha256')
    .update(String(botId))
    .update('\n')
    .update(body)
    .digest('hex')
    .slice(0, 48);
}

export async function handleLineWorksCallback({
  body,
  botIdHeader,
  signatureHeader,
  expectedBotId,
  botSecret,
  enqueue,
  nowMs = () => Date.now()
}) {
  if (!expectedBotId || !botSecret) {
    return { status: 503, body: { ok: false, code: 'CALLBACK_NOT_CONFIGURED' } };
  }

  if (String(botIdHeader || '') !== String(expectedBotId)) {
    return { status: 401, body: { ok: false, code: 'BOT_ID_MISMATCH' } };
  }

  const expectedSignature = computeLineWorksSignature(body, botSecret);
  if (!signaturesMatch(signatureHeader, expectedSignature)) {
    return { status: 401, body: { ok: false, code: 'SIGNATURE_MISMATCH' } };
  }

  let event;
  try {
    event = JSON.parse(body.toString('utf8'));
  } catch (error) {
    return { status: 400, body: { ok: false, code: 'INVALID_JSON' } };
  }

  if (!event || !ALLOWED_EVENT_TYPES.has(event.type)) {
    return { status: 200, body: { ok: true, code: 'IGNORED_EVENT' } };
  }

  if (!event.content || !ALLOWED_MESSAGE_TYPES.has(event.content.type)) {
    return { status: 200, body: { ok: true, code: 'IGNORED_MESSAGE' } };
  }

  const issuedTimeMs = Date.parse(event.issuedTime);
  const currentTimeMs = nowMs();
  if (!Number.isFinite(issuedTimeMs) ||
      issuedTimeMs < currentTimeMs - MAX_EVENT_AGE_MS ||
      issuedTimeMs > currentTimeMs + MAX_FUTURE_SKEW_MS) {
    return { status: 401, body: { ok: false, code: 'STALE_EVENT' } };
  }

  if (!event.source || typeof event.source.userId !== 'string' ||
      !event.source.userId || typeof event.content.text !== 'string' ||
      !event.content.text || event.content.text.length > MAX_TEXT_LENGTH) {
    return { status: 400, body: { ok: false, code: 'INVALID_EVENT' } };
  }

  const taskId = createCallbackTaskId(expectedBotId, body);
  await enqueue({
    taskId,
    payload: {
      version: 1,
      kind: 'lineworksCallback',
      botId: String(expectedBotId),
      event
    }
  });

  return { status: 200, body: { ok: true, code: 'ACCEPTED' } };
}
