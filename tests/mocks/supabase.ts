/**
 * @fileoverview Mock Supabase client for testing
 * 
 * Provides mock implementations of Supabase client methods
 * for unit and integration testing without actual database calls.
 */

import { vi } from 'vitest';

// Mock user for authenticated tests
export const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'authenticated',
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Test User' },
};

// Mock session
export const mockSession = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: 'bearer',
    user: mockUser,
};

// Mock Supabase auth client
export const mockSupabaseAuth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
};

// Generic query builder mock
export function createQueryBuilderMock<T>(data: T[] = []) {
    const builder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        containedBy: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: data[0] || null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: data[0] || null, error: null }),
        then: vi.fn().mockImplementation((resolve) => resolve({ data, error: null })),
    };

    // Make it thenable
    return Object.assign(Promise.resolve({ data, error: null }), builder);
}

// Mock Supabase client
export const createMockSupabaseClient = () => ({
    auth: mockSupabaseAuth,
    from: vi.fn().mockImplementation(() => createQueryBuilderMock()),
    storage: {
        from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
            download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
            getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
});

// Default mock client instance
export const mockSupabaseClient = createMockSupabaseClient();

// Mock the Supabase client imports
export const mockSupabaseClientModule = {
    createClient: vi.fn().mockReturnValue(mockSupabaseClient),
    createServerClient: vi.fn().mockReturnValue(mockSupabaseClient),
    createAdminClient: vi.fn().mockReturnValue(mockSupabaseClient),
};
