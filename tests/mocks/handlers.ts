/**
 * @fileoverview MSW request handlers for API mocking
 * 
 * Defines mock handlers for all API routes used in tests.
 * These handlers intercept network requests and return mock responses.
 */

import { http, HttpResponse } from 'msw';
import {
    mockGeneratedQuestions,
    mockFollowUpQuestion,
    mockCandidateScore,
    mockParsedResume
} from './openai';

// Base URL for API routes
const API_BASE = 'http://localhost:3000/api';

// Sample data
export const mockJobs = [
    {
        id: 'job-1',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'Remote',
        type: 'full-time',
        level: 'senior',
        description: 'We are looking for a senior software engineer...',
        required_skills: ['TypeScript', 'React', 'Node.js'],
        nice_to_have_skills: ['PostgreSQL', 'AWS'],
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        user_id: 'user-1',
    },
    {
        id: 'job-2',
        title: 'Product Designer',
        department: 'Design',
        location: 'New York, NY',
        type: 'full-time',
        level: 'mid',
        description: 'Join our design team...',
        required_skills: ['Figma', 'UI/UX'],
        nice_to_have_skills: ['Prototyping'],
        status: 'active',
        created_at: '2024-01-02T00:00:00Z',
        user_id: 'user-1',
    },
];

export const mockCandidates = [
    {
        id: 'candidate-1',
        job_id: 'job-1',
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        stage: 'applied',
        ai_score: 85,
        ai_summary: 'Strong candidate with relevant experience',
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'candidate-2',
        job_id: 'job-1',
        full_name: 'Bob Johnson',
        email: 'bob@example.com',
        stage: 'screening',
        ai_score: 72,
        ai_summary: 'Promising candidate, needs technical assessment',
        created_at: '2024-01-02T00:00:00Z',
    },
];

export const mockInterviews = [
    {
        id: 'interview-1',
        candidate_id: 'candidate-1',
        job_id: 'job-1',
        status: 'scheduled',
        scheduled_at: '2024-01-15T10:00:00Z',
        duration_minutes: 60,
        created_at: '2024-01-01T00:00:00Z',
    },
];

// API handlers
export const handlers = [
    // Jobs handlers
    http.get(`${API_BASE}/jobs`, () => {
        return HttpResponse.json(mockJobs);
    }),

    http.get(`${API_BASE}/jobs/:id`, ({ params }) => {
        const job = mockJobs.find((j) => j.id === params.id);
        if (!job) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json(job);
    }),

    http.post(`${API_BASE}/jobs`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const newJob = {
            id: `job-${Date.now()}`,
            ...body,
            created_at: new Date().toISOString(),
        };
        return HttpResponse.json(newJob, { status: 201 });
    }),

    http.put(`${API_BASE}/jobs/:id`, async ({ params, request }) => {
        const body = await request.json() as Record<string, unknown>;
        const job = mockJobs.find((j) => j.id === params.id);
        if (!job) {
            return new HttpResponse(null, { status: 404 });
        }
        const updatedJob = { ...job, ...body };
        return HttpResponse.json(updatedJob);
    }),

    http.delete(`${API_BASE}/jobs/:id`, ({ params }) => {
        const job = mockJobs.find((j) => j.id === params.id);
        if (!job) {
            return new HttpResponse(null, { status: 404 });
        }
        return new HttpResponse(null, { status: 204 });
    }),

    // Candidates handlers
    http.get(`${API_BASE}/candidates`, () => {
        return HttpResponse.json(mockCandidates);
    }),

    http.get(`${API_BASE}/candidates/:id`, ({ params }) => {
        const candidate = mockCandidates.find((c) => c.id === params.id);
        if (!candidate) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json(candidate);
    }),

    http.post(`${API_BASE}/candidates`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const newCandidate = {
            id: `candidate-${Date.now()}`,
            stage: 'applied',
            ai_score: null,
            ...body,
            created_at: new Date().toISOString(),
        };
        return HttpResponse.json(newCandidate, { status: 201 });
    }),

    http.post(`${API_BASE}/candidates/:id/move`, async ({ params, request }) => {
        const body = await request.json() as { stage: string };
        const candidate = mockCandidates.find((c) => c.id === params.id);
        if (!candidate) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({ ...candidate, stage: body.stage });
    }),

    // Interviews handlers
    http.post(`${API_BASE}/interviews/schedule`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const newInterview = {
            id: `interview-${Date.now()}`,
            status: 'scheduled',
            ...body,
            created_at: new Date().toISOString(),
        };
        return HttpResponse.json(newInterview, { status: 201 });
    }),

    http.get(`${API_BASE}/interviews/:id`, ({ params }) => {
        const interview = mockInterviews.find((i) => i.id === params.id);
        if (!interview) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json(interview);
    }),

    // AI handlers
    http.post(`${API_BASE}/ai/generate-questions`, () => {
        return HttpResponse.json(mockGeneratedQuestions);
    }),

    http.post(`${API_BASE}/ai/follow-up`, () => {
        return HttpResponse.json(mockFollowUpQuestion);
    }),

    http.post(`${API_BASE}/ai/score-candidate`, () => {
        return HttpResponse.json(mockCandidateScore);
    }),

    http.post(`${API_BASE}/ai/parse-resume`, () => {
        return HttpResponse.json(mockParsedResume);
    }),

    http.post(`${API_BASE}/ai/evaluate-answer`, () => {
        return HttpResponse.json({
            score: 8,
            feedback: 'Good answer with clear explanation.',
            strengths: ['Clear communication', 'Good examples'],
            improvements: ['Could provide more specific metrics'],
        });
    }),

    // Dashboard handlers
    http.get(`${API_BASE}/dashboard/stats`, () => {
        return HttpResponse.json({
            totalJobs: 5,
            activeJobs: 3,
            totalCandidates: 25,
            interviewsScheduled: 8,
            hiredThisMonth: 2,
        });
    }),

    http.get(`${API_BASE}/dashboard/alerts`, () => {
        return HttpResponse.json({
            alerts: [
                { id: '1', type: 'interview', message: 'Interview with Jane Smith in 1 hour' },
            ],
        });
    }),

    // Activities handlers
    http.get(`${API_BASE}/activities`, () => {
        return HttpResponse.json([
            {
                id: 'activity-1',
                type: 'candidate_applied',
                message: 'Jane Smith applied for Senior Software Engineer',
                created_at: '2024-01-01T00:00:00Z',
            },
        ]);
    }),
];
