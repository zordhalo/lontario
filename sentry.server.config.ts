// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848",
  environment: process.env.NODE_ENV,

  // Define how likely traces are sampled.
  // 10% in production, 100% in development
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Privacy: DO NOT send user PII
  sendDefaultPii: false,

  // Scrub sensitive data before sending to Sentry
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
