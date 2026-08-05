import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskEnqueuer } from '../src/task-queue.js';

function createClient(state) {
  return {
    queuePath: (project, location, queue) =>
      `projects/${project}/locations/${location}/queues/${queue}`,
    taskPath: (project, location, queue, task) =>
      `projects/${project}/locations/${location}/queues/${queue}/tasks/${task}`,
    createTask: async request => {
      state.requests.push(request);
      if (state.error) throw state.error;
    }
  };
}

function createEnqueuer(state) {
  return createTaskEnqueuer({
    projectId: 'test-project',
    location: 'asia-northeast1',
    queue: 'test-queue',
    workerUrl: 'https://worker.example.com',
    serviceAccountEmail: 'worker@test-project.iam.gserviceaccount.com',
    client: createClient(state)
  });
}

test('callback task targets the private worker with OIDC', async () => {
  const state = { requests: [] };
  const enqueue = createEnqueuer(state);
  await enqueue({ taskId: 'lw-test', payload: { version: 1 } });

  assert.equal(state.requests.length, 1);
  const request = state.requests[0];
  assert.equal(request.task.httpRequest.url,
    'https://worker.example.com/tasks/callback');
  assert.equal(request.task.httpRequest.oidcToken.audience,
    'https://worker.example.com');
  assert.equal(request.task.httpRequest.oidcToken.serviceAccountEmail,
    'worker@test-project.iam.gserviceaccount.com');
  assert.deepEqual(
    JSON.parse(Buffer.from(request.task.httpRequest.body, 'base64').toString()),
    { version: 1 }
  );
});

test('Cloud Tasks duplicate task is acknowledged', async () => {
  const state = { requests: [], error: { code: 6 } };
  const enqueue = createEnqueuer(state);
  await assert.doesNotReject(() => enqueue({
    taskId: 'lw-duplicate',
    payload: { version: 1 }
  }));
});

test('unexpected Cloud Tasks error is propagated', async () => {
  const state = { requests: [], error: { code: 7 } };
  const enqueue = createEnqueuer(state);
  await assert.rejects(() => enqueue({
    taskId: 'lw-error',
    payload: { version: 1 }
  }));
});
