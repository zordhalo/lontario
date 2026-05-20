// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Define how likely traces are sampled.
    // 10% in production, 100% in development
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Privacy: DO NOT send user PII (emails, IPs, headers, cookies, request bodies)
    sendDefaultPii: false,

    // Add OpenAI integration for AI Agents Insights — record only metadata
    // (model, token counts, latency). Inputs/outputs are NOT recorded because
    // they routinely contain candidate resumes, job descriptions, and other
    // sensitive data that must not leave the perimeter.
    integrations: [
      Sentry.openAIIntegration({
        recordInputs: false,
        recordOutputs: false,
      }),
    ],

    // Add tags for filtering in Sentry AI Agents dashboard
    initialScope: {
      tags: {
        project: "lontario-yc",
        ai_enabled: "true",
      },
    },

    // Scrub sensitive data before sending to Sentry
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
