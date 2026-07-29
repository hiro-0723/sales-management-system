import http from 'node:http';
import { callAppsScriptInternal } from './task-result.js';

const port = Number(process.env.PORT || 8080);
const appsScriptInternalUrl = process.env.APPS_SCRIPT_INTERNAL_URL || '';
const expectedQueue = process.env.CLOUD_TASKS_QUEUE || '';

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method !== 'POST' || request.url !== '/tasks/process') {
    return sendJson(response, 404, { ok: false, code: 'NOT_FOUND' });
  }

  // Cloud Run IAM/OIDC is the identity boundary. This header is an additional
  // routing guard only and must not be treated as authentication by itself.
  const queueName = request.headers['x-cloudtasks-queuename'];
  if (!expectedQueue || queueName !== expectedQueue) {
    return sendJson(response, 403, {
      ok: false,
      code: 'UNEXPECTED_TASK_QUEUE'
    });
  }

  try {
    const envelope = await readJson(request);
    const result = await callAppsScriptInternal({
      url: appsScriptInternalUrl,
      envelope
    });
    return sendJson(response, result.status, result.body);
  } catch (error) {
    console.error('Task processing failed', {
      message: String(error && error.message || error)
    });
    return sendJson(response, 503, {
      ok: false,
      code: 'TASK_PROCESSING_FAILED'
    });
  }
});

server.listen(port, () => {
  console.log(`sales-lineworks-webhook listening on ${port}`);
});
