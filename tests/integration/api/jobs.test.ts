/**
 * @fileoverview Integration tests for /api/jobs routes
 * 
 * Tests job CRUD operations through the API layer.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/server';
import { mockJobs } from '@/tests/mocks/handlers';

// Mock fetch for API calls
const baseUrl = 'http://localhost:3000/api';

describe('Jobs API Integration', () => {
    describe('GET /api/jobs', () => {
        it('should return a list of jobs', async () => {
            const response = await fetch(`${baseUrl}/jobs`);
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data).toBeInstanceOf(Array);
            expect(data.length).toBeGreaterThan(0);
        });

        it('should return jobs with required fields', async () => {
            const response = await fetch(`${baseUrl}/jobs`);
            const data = await response.json();
            const job = data[0];

            expect(job).toHaveProperty('id');
            expect(job).toHaveProperty('title');
            expect(job).toHaveProperty('department');
            expect(job).toHaveProperty('status');
        });
    });

    describe('GET /api/jobs/:id', () => {
        it('should return a single job by ID', async () => {
            const response = await fetch(`${baseUrl}/jobs/job-1`);
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.id).toBe('job-1');
            expect(data.title).toBe('Senior Software Engineer');
        });

        it('should return 404 for non-existent job', async () => {
            const response = await fetch(`${baseUrl}/jobs/non-existent`);

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/jobs', () => {
        it('should create a new job', async () => {
            const newJob = {
                title: 'Product Manager',
                department: 'Product',
                location: 'Remote',
                type: 'full-time',
                level: 'senior',
                description: 'Lead product initiatives',
                required_skills: ['Product Strategy', 'Roadmapping'],
                status: 'draft',
            };

            const response = await fetch(`${baseUrl}/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJob),
            });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.title).toBe(newJob.title);
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('created_at');
        });
    });

    describe('PUT /api/jobs/:id', () => {
        it('should update an existing job', async () => {
            const updates = {
                title: 'Updated Title',
                status: 'active',
            };

            const response = await fetch(`${baseUrl}/jobs/job-1`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.title).toBe('Updated Title');
        });

        it('should return 404 when updating non-existent job', async () => {
            const response = await fetch(`${baseUrl}/jobs/non-existent`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Test' }),
            });

            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /api/jobs/:id', () => {
        it('should delete a job', async () => {
            const response = await fetch(`${baseUrl}/jobs/job-1`, {
                method: 'DELETE',
            });

            expect(response.status).toBe(204);
        });

        it('should return 404 when deleting non-existent job', async () => {
            const response = await fetch(`${baseUrl}/jobs/non-existent`, {
                method: 'DELETE',
            });

            expect(response.status).toBe(404);
        });
    });
});
