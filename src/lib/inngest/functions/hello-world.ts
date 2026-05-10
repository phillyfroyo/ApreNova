import { inngest } from '../client';

// Smoke-test function. Triggered by sending an event named "test/hello-world".
// Does nothing real — just proves the webhook handshake works end-to-end.
// Safe to delete once the real story-pipeline function is wired up.
export const helloWorld = inngest.createFunction(
  {
    id: 'hello-world',
    triggers: [{ event: 'test/hello-world' }],
  },
  async ({ event, step }) => {
    await step.run('log-payload', async () => {
      console.log('[inngest] hello-world fired with payload:', event.data);
      return { received: event.data };
    });

    return { ok: true, message: 'hello from inngest' };
  },
);
