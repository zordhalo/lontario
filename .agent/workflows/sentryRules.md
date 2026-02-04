---
description: Sentry error tracking and performance monitoring configuration rules for Next.js
---

# Sentry Configuration Rules

These rules should be used as guidance when configuring Sentry functionality within the lontario-YC project.

## Project Configuration

- **DSN**: `https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848`
- **Organization**: `advance-labs-bq`
- **Project**: `javascript-nextjs`

## Configuration Files

In Next.js, Sentry initialization happens in specific files:

| File | Purpose |
|------|---------|
| `instrumentation-client.(js\|ts)` | Client-side initialization |
| `sentry.server.config.ts` | Server-side initialization |
| `sentry.edge.config.ts` | Edge runtime initialization |

> [!IMPORTANT]
> Initialization does not need to be repeated in other files. Use `import * as Sentry from "@sentry/nextjs"` to reference Sentry functionality throughout the application.

---

## Exception Catching

Use `Sentry.captureException(error)` to capture exceptions and log errors in Sentry.

```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  // Handle error appropriately
}
```

---

## Tracing & Spans

Spans should be created for meaningful actions within the application:
- Button clicks
- API calls
- Function calls

Use `Sentry.startSpan` to create spans. Child spans can exist within a parent span.

### Component Action Spans

The `name` and `op` properties should be meaningful for the activities in the call. Attach attributes based on relevant information and metrics.

```typescript
function TestComponent() {
  const handleTestButtonClick = () => {
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Test Button Click",
      },
      (span) => {
        const value = "some config";
        const metric = "some metric";

        // Metrics can be added to the span
        span.setAttribute("config", value);
        span.setAttribute("metric", metric);

        doSomething();
      },
    );
  };

  return (
    <button type="button" onClick={handleTestButtonClick}>
      Test Sentry
    </button>
  );
}
```

### API Call Spans

```typescript
async function fetchUserData(userId: string) {
  return Sentry.startSpan(
    {
      op: "http.client",
      name: `GET /api/users/${userId}`,
    },
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      return data;
    },
  );
}
```

---

## Logging

### Baseline Configuration

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848",
  enableLogs: true,
});
```

### Console Logging Integration

Automatically log specific console error types without instrumenting individual logger calls:

```typescript
Sentry.init({
  dsn: "https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848",
  integrations: [
    // Send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
});
```

### Logger Usage

`logger.fmt` is a template literal function for bringing variables into structured logs.

```typescript
const { logger } = Sentry;

logger.trace("Starting database connection", { database: "users" });
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
logger.info("Updated profile", { profileId: 345 });
logger.warn("Rate limit reached for endpoint", {
  endpoint: "/api/results/",
  isEnterprise: false,
});
logger.error("Failed to process payment", {
  orderId: "order_123",
  amount: 99.99,
});
logger.fatal("Database connection pool exhausted", {
  database: "users",
  activeConnections: 100,
});
```

---

## Privacy Requirements

> [!CAUTION]
> Never capture user emails or PII. Always scrub sensitive data from payloads.

Use `beforeSend` to filter sensitive data:

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  }
});
```

---

## Performance Configuration

| Setting | Development | Production |
|---------|-------------|------------|
| `tracesSampleRate` | `1.0` (100%) | `0.1` (10%) |
| `replaysSessionSampleRate` | - | `0.1` (10%) |
| `replaysOnErrorSampleRate` | - | `1.0` (100%) |

---

## Client Configuration

```typescript
// sentry.client.config.ts or instrumentation-client.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration()
  ],
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  }
});
```

## Server Configuration

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enableLogs: true,
  integrations: [
    Sentry.prismaIntegration() // If using Prisma
  ]
});
```

---

## Error Boundary Component

```tsx
// components/ErrorBoundary.tsx
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

function ErrorFallback() {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={() => window.location.reload()}>Try again</button>
    </div>
  );
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error, componentStack) => {
        console.error('Error caught by boundary:', error);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
```

---

## Environment Variables

```bash
SENTRY_DSN=https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848
NEXT_PUBLIC_SENTRY_DSN=https://5bff9440a5dd36735f2c9ec10476c7a2@o4510828351324160.ingest.us.sentry.io/4510828353486848
SENTRY_AUTH_TOKEN=
SENTRY_ORG=advance-labs-bq
SENTRY_PROJECT=javascript-nextjs
```

---

## Installation

```bash
# Automatic setup (recommended)
npx @sentry/wizard@latest -i nextjs --saas --org advance-labs-bq --project javascript-nextjs

# Manual installation
pnpm add @sentry/nextjs
```
