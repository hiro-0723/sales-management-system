import { CloudTasksClient } from '@google-cloud/tasks';

export function createTaskEnqueuer({
  projectId,
  location,
  queue,
  workerUrl,
  serviceAccountEmail,
  client = new CloudTasksClient()
}) {
  if (!projectId || !location || !queue || !workerUrl || !serviceAccountEmail) {
    throw new Error('Cloud Tasks callback delivery is not configured');
  }

  const parent = client.queuePath(projectId, location, queue);
  return async ({ taskId, payload }) => {
    const task = {
      name: client.taskPath(projectId, location, queue, taskId),
      httpRequest: {
        httpMethod: 'POST',
        url: workerUrl.replace(/\/$/, '') + '/tasks/callback',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        oidcToken: {
          serviceAccountEmail,
          audience: workerUrl
        }
      }
    };

    try {
      await client.createTask({ parent, task });
    } catch (error) {
      if (Number(error && error.code) === 6) return;
      throw error;
    }
  };
}
