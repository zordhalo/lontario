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

  // AI Agents Insights: Enable to capture LLM prompts and responses
  // Note: AI prompts in this app don't contain user PII, only job/candidate data
  sendDefaultPii: true,

  // Add OpenAI integration for AI Agents Insights
  integrations: [
    Sentry.openAIIntegration({
      recordInputs: true,  // Capture prompts
      recordOutputs: true, // Capture responses
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
