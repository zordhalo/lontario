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

            // Coverage thresholds - 80% minimum
            thresholds: {
                branches: 80,
                functions: 80,
                lines: 80,
                statements: 80,
            },

            // Files to include in coverage
            include: [
                'lib/**/*.{ts,tsx}',
                'hooks/**/*.{ts,tsx}',
                'components/**/*.{ts,tsx}',
                'app/api/**/*.{ts,tsx}',
            ],

            // Files to exclude from coverage
            exclude: [
                'node_modules',
                'tests',
                '**/*.d.ts',
                '**/*.config.*',
                '**/types/**',
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
