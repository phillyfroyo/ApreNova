// Inngest webhook handler. Inngest's cloud calls this endpoint to invoke
// registered functions; the SDK validates each call against INNGEST_SIGNING_KEY.

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { helloWorld } from '@/lib/inngest/functions/hello-world';
import { processUserStoryFn } from '@/lib/inngest/functions/process-user-story';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [helloWorld, processUserStoryFn],
});
