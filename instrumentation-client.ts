// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848",
  environment: process.env.NODE_ENV,

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Define how likely traces are sampled. Adjust this value in production.
  // 10% in production, 100% in development
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // 10% of sessions in production
  replaysSessionSampleRate: 0.1,

  // 100% capture when an error occurs
  replaysOnErrorSampleRate: 1.0,

  // Privacy: DO NOT send user PII (Personally Identifiable Information)
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
