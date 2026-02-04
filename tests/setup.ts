/**
 * @fileoverview Global test setup for Vitest
 * 
 * This file runs before all tests to:
 * - Extend expect with jest-dom matchers
 * - Set up MSW server for API mocking
 * - Configure global test utilities
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

// Extend matchers
// Note: @testing-library/jest-dom/vitest already extends matchers

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-project.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

// MSW Server Lifecycle
beforeAll(() => {
    // Start MSW server before all tests
    server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
    // Reset handlers to default state after each test
    server.resetHandlers();
    // Clean up React Testing Library
    cleanup();
});

afterAll(() => {
    // Close MSW server after all tests
    server.close();
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
    useParams: () => ({}),
    redirect: vi.fn(),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
    useTheme: () => ({
        theme: 'light',
        setTheme: vi.fn(),
        resolvedTheme: 'light',
        themes: ['light', 'dark'],
    }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
