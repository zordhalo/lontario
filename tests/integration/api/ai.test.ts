/**
 * @fileoverview Integration tests for /api/ai routes
 * 
 * Tests AI endpoints with mocked OpenAI responses.
 */

import { describe, it, expect } from 'vitest';

const baseUrl = 'http://localhost:3000/api';

describe('AI API Integration', () => {
    describe('POST /api/ai/generate-questions', () => {
        it('should generate interview questions', async () => {
            const payload = {
                job_id: 'job-1',
                candidate_id: 'candidate-1',
            };

            const response = await fetch(`${baseUrl}/ai/generate-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data).toHaveProperty('questions');
            expect(data.questions).toBeInstanceOf(Array);
        });

        it('should return questions with required fields', async () => {
            const payload = {
                job_id: 'job-1',
                candidate_id: 'candidate-1',
            };

            const response = await fetch(`${baseUrl}/ai/generate-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            const question = data.questions[0];

            expect(question).toHaveProperty('id');
            expect(question).toHaveProperty('category');
            expect(question).toHaveProperty('difficulty');
            expect(question).toHaveProperty('question');
        });
    });

    describe('POST /api/ai/score-candidate', () => {
        it('should score a candidate', async () => {
            const payload = {
                candidate_id: 'candidate-1',
                job_id: 'job-1',
            };

            const response = await fetch(`${baseUrl}/ai/score-candidate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data).toHaveProperty('overall_score');
            expect(data).toHaveProperty('breakdown');
        });
    });

    describe('POST /api/ai/parse-resume', () => {
        it('should parse resume text', async () => {
            const payload = {
                resume_text: 'John Doe\njohn@example.com\nSoftware Engineer\nSkills: JavaScript, React',
            };

            const response = await fetch(`${baseUrl}/ai/parse-resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data).toHaveProperty('name');
            expect(data).toHaveProperty('email');
            expect(data).toHaveProperty('skills');
        });
    });

    describe('POST /api/ai/evaluate-answer', () => {
        it('should evaluate an interview answer', async () => {
            const payload = {
                question_id: 'q1',
                answer: 'I would approach this by first understanding the requirements...',
                job_id: 'job-1',
            };

            const response = await fetch(`${baseUrl}/ai/evaluate-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data).toHaveProperty('score');
            expect(data).toHaveProperty('feedback');
            expect(data).toHaveProperty('strengths');
            expect(data).toHaveProperty('improvements');
        });
    });
});
