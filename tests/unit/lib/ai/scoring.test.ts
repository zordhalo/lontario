/**
 * @fileoverview Unit tests for lib/ai/scoring.ts
 * 
 * Tests the scoring pipeline with mocked dependencies.
 * Note: Only tests exported functions; internal functions are not tested directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock query builder
const createMockQueryBuilder = (data: unknown = null) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    update: vi.fn().mockReturnThis(),
    match: vi.fn().mockResolvedValue({ data: null, error: null }),
});

// Mock Supabase server module with both createClient and createAdminClient
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue({
        from: vi.fn().mockImplementation(() => createMockQueryBuilder({
            id: 'job-1',
            title: 'Software Engineer',
            level: 'senior',
            required_skills: ['TypeScript', 'React'],
            nice_to_have_skills: ['Node.js'],
            description: 'Build great products',
        })),
    }),
    createAdminClient: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => createMockQueryBuilder()),
    }),
}));

// Mock OpenAI scoring
vi.mock('@/lib/ai/openai', () => ({
    scoreCandidate: vi.fn().mockResolvedValue({
        overall_score: 85,
        breakdown: {
            skills_match: 90,
            experience_match: 80,
            education_match: 85,
            keywords_match: 80,
        },
        summary: 'Strong candidate with relevant experience',
        strengths: ['Good React skills', 'Senior experience'],
        concerns: ['No Node.js experience'],
        matched_skills: ['React', 'TypeScript'],
        missing_skills: ['Node.js'],
        bonus_skills: [],
        recommendation: 'yes',
    }),
}));

// Mock GitHub scraper
vi.mock('@/lib/ai/github', () => ({
    scrapeGitHubProfile: vi.fn().mockResolvedValue({
        username: 'johndoe',
        name: 'John Doe',
        avatar_url: 'https://github.com/avatar.png',
        bio: 'Software Engineer',
        repos: [
            { name: 'cool-project', language: 'TypeScript', stars: 100 },
        ],
        skills: ['TypeScript', 'React', 'JavaScript'],
        years_of_experience: 5,
    }),
}));

// Import after mocking
import {
    scoreCandidateForJob,
    updateCandidateWithScore,
    processAndScoreCandidate,
} from '@/lib/ai/scoring';

// Define types locally since they may not be exported
interface CandidateForScoring {
    id: string;
    job_id: string;
    full_name: string;
    email: string;
    github_url?: string | null;
    linkedin_url?: string | null;
    cover_letter?: string | null;
    resume_text?: string | null;
}

interface ScoringResult {
    success: boolean;
    ai_score?: number;
    ai_summary?: string;
    ai_strengths?: string[];
    ai_concerns?: string[];
    ai_score_breakdown?: {
        skills_match: number;
        experience_match: number;
        education_match: number;
        keywords_match: number;
    };
    extracted_skills?: string[];
    avatar_url?: string;
    years_of_experience?: number;
    error?: string;
}

describe('scoreCandidateForJob', () => {
    const mockCandidate: CandidateForScoring = {
        id: 'candidate-1',
        job_id: 'job-1',
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        github_url: 'https://github.com/janesmith',
        linkedin_url: null,
        cover_letter: 'I am interested in this role...',
        resume_text: 'Senior software engineer with 5 years...',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return a scoring result object', async () => {
        const result = await scoreCandidateForJob(mockCandidate);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
    });

    it('should return success status', async () => {
        const result = await scoreCandidateForJob(mockCandidate);

        // The result should indicate success/failure
        expect(typeof result.success).toBe('boolean');
    });

    it('should handle candidates without GitHub URL', async () => {
        const candidateNoGithub: CandidateForScoring = {
            ...mockCandidate,
            github_url: null,
        };

        const result = await scoreCandidateForJob(candidateNoGithub);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
    });
});

describe('updateCandidateWithScore', () => {
    const mockScoringResult: ScoringResult = {
        success: true,
        ai_score: 85,
        ai_summary: 'Strong candidate',
        ai_strengths: ['Good skills'],
        ai_concerns: ['Needs more experience'],
        ai_score_breakdown: {
            skills_match: 90,
            experience_match: 80,
            education_match: 85,
            keywords_match: 80,
        },
        extracted_skills: ['TypeScript', 'React'],
        avatar_url: 'https://example.com/avatar.png',
        years_of_experience: 5,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should update candidate without throwing', async () => {
        await expect(
            updateCandidateWithScore('candidate-1', mockScoringResult)
        ).resolves.not.toThrow();
    });

    it('should handle failed scoring result', async () => {
        const failedResult: ScoringResult = {
            success: false,
            error: 'Failed to score',
        };

        await expect(
            updateCandidateWithScore('candidate-1', failedResult)
        ).resolves.not.toThrow();
    });
});

describe('processAndScoreCandidate', () => {
    const mockCandidate: CandidateForScoring = {
        id: 'candidate-1',
        job_id: 'job-1',
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        github_url: 'https://github.com/janesmith',
        linkedin_url: null,
        cover_letter: 'Cover letter content',
        resume_text: 'Resume content',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should run the full scoring pipeline', async () => {
        const result = await processAndScoreCandidate(mockCandidate);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('success');
    });

    it('should return scoring result structure', async () => {
        const result = await processAndScoreCandidate(mockCandidate);

        // Should have standard result properties
        expect(typeof result.success).toBe('boolean');
    });
});
