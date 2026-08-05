import http from 'node:http';
import fs from 'node:fs';
import { callAppsScriptInternal } from './task-result.js';
import { handleLineWorksCallback } from './callback.js';
import { createTaskEnqueuer } from './task-queue.js';

const port = Number(process.env.PORT || 8080);
const appsScriptInternalUrl = process.env.APPS_SCRIPT_INTERNAL_URL || '';
const expectedQueue = process.env.CLOUD_TASKS_QUEUE || '';
const serviceMode = process.env.SERVICE_MODE || 'worker';
const lineWorksBotId = process.env.LINEWORKS_BOT_ID || '';
const lineWorksBotSecretFile = process.env.LINEWORKS_BOT_SECRET_FILE || '';

function readSecretFile(path) {
  return path ? fs.readFileSync(path, 'utf8').trim() : '';
}

const lineWorksBotSecret = serviceMode === 'callback'
  ? readSecretFile(lineWorksBotSecretFile)
  : '';

const enqueueCallback = serviceMode === 'callback'
  ? createTaskEnqueuer({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
      location: process.env.CLOUD_TASKS_LOCATION || '',
      queue: expectedQueue,
      workerUrl: process.env.CLOUD_TASKS_WORKER_URL || '',
      serviceAccountEmail: process.env.CLOUD_TASKS_OIDC_SERVICE_ACCOUNT || ''
    })
  : null;

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    return sendJson(response, 200, { ok: true, mode: serviceMode });
  }

  if (serviceMode === 'callback' &&
      request.method === 'POST' && request.url === '/callback') {
    try {
      const body = await readBody(request);
      const result = await handleLineWorksCallback({
        body,
        botIdHeader: request.headers['x-works-botid'],
        signatureHeader: request.headers['x-works-signature'],
        expectedBotId: lineWorksBotId,
        botSecret: lineWorksBotSecret,
        enqueue: enqueueCallback
      });
      return sendJson(response, result.status, result.body);
    } catch (error) {
      console.error('Callback processing failed', {
        message: String(error && error.message || error)
      });
      return sendJson(response, 503, {
        ok: false,
        code: 'CALLBACK_PROCESSING_FAILED'
      });
    }
  }

  if (serviceMode !== 'worker' || request.method !== 'POST' ||
      !['/tasks/process', '/tasks/callback'].includes(request.url)) {
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
    const requestBody = await readBody(request);
    const envelope = JSON.parse(requestBody.toString('utf8'));
    if (request.url === '/tasks/callback') {
      if (envelope.version !== 1 || envelope.kind !== 'lineworksCallback') {
        return sendJson(response, 200, {
          ok: false,
          code: 'INVALID_CALLBACK_TASK'
        });
      }
      return sendJson(response, 200, {
        ok: true,
        code: 'CALLBACK_ACCEPTED'
      });
    }
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
  console.log(`sales-lineworks ${serviceMode} listening on ${port}`);
});
