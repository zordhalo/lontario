/**
 * @fileoverview Integration tests for /api/candidates routes
 * 
 * Tests candidate operations through the API layer.
 */

import { describe, it, expect } from 'vitest';

const baseUrl = 'http://localhost:3000/api';

describe('Candidates API Integration', () => {
    describe('GET /api/candidates', () => {
        it('should return a list of candidates', async () => {
            const response = await fetch(`${baseUrl}/candidates`);
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data).toBeInstanceOf(Array);
        });

        it('should return candidates with required fields', async () => {
            const response = await fetch(`${baseUrl}/candidates`);
            const data = await response.json();

            if (data.length > 0) {
                const candidate = data[0];
                expect(candidate).toHaveProperty('id');
                expect(candidate).toHaveProperty('full_name');
                expect(candidate).toHaveProperty('email');
                expect(candidate).toHaveProperty('stage');
            }
        });
    });

    describe('GET /api/candidates/:id', () => {
        it('should return a single candidate by ID', async () => {
            const response = await fetch(`${baseUrl}/candidates/candidate-1`);
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.id).toBe('candidate-1');
        });

        it('should return 404 for non-existent candidate', async () => {
            const response = await fetch(`${baseUrl}/candidates/non-existent`);

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/candidates', () => {
        it('should create a new candidate (application)', async () => {
            const newCandidate = {
                job_id: 'job-1',
                full_name: 'New Applicant',
                email: 'applicant@example.com',
                cover_letter: 'I am interested in this position...',
                resume_text: 'Software Engineer with 5 years experience...',
            };

            const response = await fetch(`${baseUrl}/candidates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCandidate),
            });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.full_name).toBe(newCandidate.full_name);
            expect(data.stage).toBe('applied');
        });
    });

    describe('POST /api/candidates/:id/move', () => {
        it('should move candidate to a new stage', async () => {
            const response = await fetch(`${baseUrl}/candidates/candidate-1/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: 'interview' }),
            });
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.stage).toBe('interview');
        });

        it('should return 404 for non-existent candidate', async () => {
            const response = await fetch(`${baseUrl}/candidates/non-existent/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: 'interview' }),
            });

            expect(response.status).toBe(404);
        });
    });
});
