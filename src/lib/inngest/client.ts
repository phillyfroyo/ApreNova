import { Inngest } from 'inngest';

// Inngest client singleton — used by the webhook route to register functions
// and by API routes to send events that trigger background jobs.
//
// Authentication uses INNGEST_EVENT_KEY (for sending) and INNGEST_SIGNING_KEY
// (for verifying calls into our webhook). Both are read from the environment;
// no fallback values are baked in.
export const inngest = new Inngest({
  id: 'cuentana',
});
