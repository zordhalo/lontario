/**
 * @fileoverview Unit tests for lib/ai/openai.ts
 * 
 * Tests OpenAI integration functions with mocked API responses.
 * Note: These tests mock the OpenAI client to avoid actual API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock responses for different scenarios
const createMockParsedResponse = (content: object) => ({
    id: 'chatcmpl-test',
    choices: [
        {
            message: {
                parsed: content,
                content: JSON.stringify(content),
            },
            finish_reason: 'stop',
        },
    ],
});

// Mock data
const mockQuestions = {
    questions: [
        {
            id: 'q1',
            category: 'technical',
            difficulty: 'medium',
            question: 'Explain React hooks and when you would use them.',
            context: 'Tests understanding of modern React patterns.',
            estimatedTime: 5,
            scoringRubric: [
                {
                    aspect: 'Technical Accuracy',
                    weight: 0.4,
                    excellent: 'Correctly explains useState, useEffect, custom hooks',
                    good: 'Understands basic hooks',
                    needsWork: 'Unclear about hook rules',
                },
            ],
        },
    ],
};

const mockScore = {
    overall_score: 85,
    breakdown: {
        skills_match: 90,
        experience_match: 80,
        education_match: 85,
        keywords_match: 80,
    },
    summary: 'Strong candidate with relevant experience',
    strengths: ['Good React skills', 'Senior experience'],
    concerns: ['Limited Node.js experience'],
    matched_skills: ['React', 'TypeScript'],
    missing_skills: ['Node.js'],
    bonus_skills: ['AWS'],
    recommendation: 'yes',
};

const mockParsedResume = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 555-123-4567',
    location: 'San Francisco, CA',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    years_of_experience: 5,
    experience: [
        {
            company: 'Tech Corp',
            title: 'Senior Engineer',
            start_date: '2020-01',
            end_date: 'Present',
            highlights: ['Led team of 5'],
        },
    ],
    education: [
        {
            institution: 'State University',
            degree: 'BS Computer Science',
            graduation_date: '2018',
        },
    ],
};

// Mock the OpenAI module with beta.chat.completions.parse support
vi.mock('openai', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            beta: {
                chat: {
                    completions: {
                        parse: vi.fn().mockImplementation(async ({ messages }) => {
                            const userContent = messages[1]?.content || '';

                            // Return appropriate response based on prompt content
                            if (userContent.includes('JOB DETAILS') && userContent.includes('CANDIDATE PROFILE')) {
                                return createMockParsedResponse(mockQuestions);
                            }
                            if (userContent.includes('JOB REQUIREMENTS') && userContent.includes('RESUME EXCERPT')) {
                                return createMockParsedResponse(mockScore);
                            }
                            if (userContent.includes('Parse this resume')) {
                                return createMockParsedResponse(mockParsedResume);
                            }

                            // Default
                            return createMockParsedResponse(mockQuestions);
                        }),
                    },
                },
            },
            chat: {
                completions: {
                    create: vi.fn().mockImplementation(async () => ({
                        id: 'chatcmpl-test',
                        choices: [
                            {
                                message: {
                                    content: 'Generated job description with responsibilities and requirements...',
                                },
                                finish_reason: 'stop',
                            },
                        ],
                    })),
                },
            },
        })),
    };
});

// Import after mocking
import {
    generateInterviewQuestions,
    scoreCandidate,
    parseResume,
    generateJobDescription,
} from '@/lib/ai/openai';
import type { JobDescription, CandidateProfile } from '@/types';

describe('generateInterviewQuestions', () => {
    const mockJob: JobDescription = {
        title: 'Senior Software Engineer',
        level: 'senior',
        requiredSkills: ['TypeScript', 'React', 'Node.js'],
        niceToHave: ['PostgreSQL', 'AWS'],
        description: 'Build awesome products for our platform',
    };

    const mockCandidate: CandidateProfile = {
        name: 'Jane Doe',
        source: 'github',
        skills: ['TypeScript', 'React', 'JavaScript'],
        bio: 'Passionate developer',
        projects: [
            {
                name: 'Cool App',
                description: 'A cool app',
                language: 'TypeScript',
                stars: 100,
            },
        ],
        experience: [
            'Built features at Tech Corp',
            'Led team of 5 engineers',
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate interview questions for a candidate', async () => {
        const result = await generateInterviewQuestions(mockJob, mockCandidate);

        expect(result).toBeDefined();
        expect(result.questions).toBeInstanceOf(Array);
        expect(result.questions.length).toBeGreaterThan(0);
    });

    it('should return questions with required fields', async () => {
        const result = await generateInterviewQuestions(mockJob, mockCandidate);
        const question = result.questions[0];

        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('category');
        expect(question).toHaveProperty('difficulty');
        expect(question).toHaveProperty('question');
    });

    it('should categorize questions correctly', async () => {
        const result = await generateInterviewQuestions(mockJob, mockCandidate);
        const question = result.questions[0];

        expect(['technical', 'behavioral', 'system-design', 'problem-solving', 'culture-fit'])
            .toContain(question.category);
    });
});

describe('scoreCandidate', () => {
    const mockCandidateData = {
        skills: ['JavaScript', 'React', 'TypeScript'],
        experience: ['Built web apps at startup', 'Led frontend team'],
        resume_text: 'Experienced software engineer with 5 years of experience...',
        years_of_experience: 5,
        education_level: 'Bachelor',
    };

    const mockJobData = {
        title: 'Frontend Developer',
        level: 'mid',
        required_skills: ['JavaScript', 'React', 'CSS'],
        nice_to_have_skills: ['TypeScript'],
        description: 'Frontend development role',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should score a candidate against job requirements', async () => {
        const result = await scoreCandidate(mockCandidateData, mockJobData);

        expect(result).toBeDefined();
        expect(result.overall_score).toBeDefined();
        expect(typeof result.overall_score).toBe('number');
    });

    it('should return score breakdown', async () => {
        const result = await scoreCandidate(mockCandidateData, mockJobData);

        expect(result.breakdown).toBeDefined();
        expect(result.breakdown.skills_match).toBeDefined();
    });

    it('should include strengths and concerns', async () => {
        const result = await scoreCandidate(mockCandidateData, mockJobData);

        expect(result.strengths).toBeDefined();
        expect(result.concerns).toBeDefined();
    });
});

describe('parseResume', () => {
    const sampleResume = `
    John Doe
    john.doe@example.com
    Software Engineer with 5 years experience
    Skills: JavaScript, TypeScript, React, Node.js
  `;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should parse resume text into structured data', async () => {
        const result = await parseResume(sampleResume);

        expect(result).toBeDefined();
        expect(result.name).toBeDefined();
        expect(result.skills).toBeInstanceOf(Array);
    });

    it('should extract contact information', async () => {
        const result = await parseResume(sampleResume);

        expect(result.email).toBeDefined();
    });

    it('should calculate years of experience', async () => {
        const result = await parseResume(sampleResume);

        expect(result.years_of_experience).toBeDefined();
        expect(typeof result.years_of_experience).toBe('number');
    });
});

describe('generateJobDescription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate a job description', async () => {
        const result = await generateJobDescription({
            title: 'Senior Software Engineer',
            level: 'senior',
            required_skills: ['TypeScript', 'React'],
            department: 'Engineering',
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('should work with minimal options', async () => {
        const result = await generateJobDescription({
            title: 'Developer',
            required_skills: ['JavaScript'],
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });
});
