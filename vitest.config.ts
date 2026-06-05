import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        // Environment
        environment: 'jsdom',

        // Setup files
        setupFiles: ['./tests/setup.ts'],

        // Globals (describe, it, expect available globally)
        globals: true,

        // Include patterns
        include: [
            'tests/unit/**/*.{test,spec}.{ts,tsx}',
            'tests/integration/**/*.{test,spec}.{ts,tsx}',
        ],

        // Exclude patterns
        exclude: [
            'node_modules',
            'e2e',
            '.next',
        ],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov', 'json'],
            reportsDirectory: './coverage',

            thresholds: {
                // Error-handling branches (try/catch, production-only paths) are
                // intentionally not exercised in unit tests; 65% is the floor.
                branches: 65,
                functions: 80,
                // The remaining uncovered lines are Supabase/AI-pipeline error paths
                // that belong in integration/E2E tests, not unit tests.
                lines: 79,
                statements: 79,
            },

            // Coverage scope: pure business logic in lib/ only.
            // React components (components/**) belong to E2E (Playwright).
            // Next.js route handlers (app/api/**) and hooks need the full
            // Next.js runtime; they're covered by integration/E2E tests.
            include: [
                'lib/**/*.{ts,tsx}',
            ],

            // Files to exclude from coverage
            exclude: [
                'node_modules',
                'tests',
                '**/*.d.ts',
                '**/*.config.*',
                '**/types/**',
                // External-HTTP clients — tested via integration/E2E
                'lib/ai/github.ts',
                'lib/ai/linkedin.ts',
                // Re-export barrels add no logic
                'lib/ai/index.ts',
                'lib/stores/index.ts',
                // External integration points — tested via E2E
                'lib/security/botid.ts',
                // Supabase client factories — require live Supabase
                'lib/supabase/**',
                // Email sending — require live Resend
                'lib/email/**',
                // Zustand stores with fetch calls — tested via E2E
                'lib/stores/**',
                // Static data file — no logic to test
                'lib/mock-data.ts',
            ],
        },

        // TypeScript support
        typecheck: {
            enabled: false,
        },
    },

    // Path aliases matching tsconfig
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
