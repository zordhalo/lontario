/**
 * @fileoverview Mock OpenAI client for testing
 * 
 * Provides mock implementations of OpenAI API responses
 * for testing AI-related functionality without actual API calls.
 */

import { vi } from 'vitest';

// Mock generated interview questions
export const mockGeneratedQuestions = {
    questions: [
        {
            id: 'q1',
            category: 'technical',
            difficulty: 'medium',
            question: 'Explain the difference between server components and client components in React.',
            context: 'Tests understanding of React Server Components architecture.',
            follow_up_prompts: [
                'When would you choose one over the other?',
                'How does data fetching differ between them?',
            ],
            time_estimate: 5,
        },
        {
            id: 'q2',
            category: 'behavioral',
            difficulty: 'easy',
            question: 'Describe a challenging project you worked on and how you overcame obstacles.',
            context: 'Assesses problem-solving and perseverance.',
            follow_up_prompts: [
                'What would you do differently?',
                'How did you collaborate with your team?',
            ],
            time_estimate: 4,
        },
        {
            id: 'q3',
            category: 'system-design',
            difficulty: 'hard',
            question: 'How would you design a real-time notification system for a large-scale application?',
            context: 'Tests system design and scalability thinking.',
            follow_up_prompts: [
                'How would you handle millions of concurrent users?',
                'What would be your approach to ensuring delivery?',
            ],
            time_estimate: 8,
        },
    ],
};

// Mock follow-up question
export const mockFollowUpQuestion = {
    question: 'Can you elaborate on how you handled the edge cases in that situation?',
    rationale: 'Probes deeper understanding of edge case handling.',
};

// Mock candidate score
export const mockCandidateScore = {
    overall_score: 85,
    breakdown: {
        skills_match: 90,
        experience_match: 80,
        education_match: 85,
        keywords_match: 85,
    },
    summary: 'Strong candidate with excellent technical skills and relevant experience.',
    strengths: [
        'Strong React and TypeScript experience',
        'Proven track record with SaaS products',
        'Good communication skills',
    ],
    concerns: [
        'Limited experience with large-scale systems',
        'No prior experience with our specific tech stack',
    ],
    recommendation: 'Recommended for technical interview',
};

// Mock parsed resume
export const mockParsedResume = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    linkedin_url: 'https://linkedin.com/in/johndoe',
    github_url: 'https://github.com/johndoe',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    years_of_experience: 5,
    experience: [
        {
            company: 'Tech Corp',
            title: 'Senior Software Engineer',
            start_date: '2021-01',
            end_date: 'Present',
            highlights: [
                'Led team of 5 engineers on customer-facing product',
                'Reduced page load time by 40%',
            ],
        },
    ],
    education: [
        {
            institution: 'State University',
            degree: 'BS Computer Science',
            graduation_date: '2018-05',
        },
    ],
};

// Mock OpenAI chat completion response
export const createMockCompletion = (content: object) => ({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
        {
            index: 0,
            message: {
                role: 'assistant',
                content: JSON.stringify(content),
            },
            finish_reason: 'stop',
        },
    ],
    usage: {
        prompt_tokens: 100,
        completion_tokens: 200,
        total_tokens: 300,
    },
});

// Mock OpenAI client
export const mockOpenAIClient = {
    chat: {
        completions: {
            create: vi.fn().mockImplementation(async ({ messages }) => {
                const prompt = messages[messages.length - 1]?.content || '';

                // Return different responses based on the prompt content
                if (prompt.includes('generate') && prompt.includes('question')) {
                    return createMockCompletion(mockGeneratedQuestions);
                }
                if (prompt.includes('follow-up') || prompt.includes('follow up')) {
                    return createMockCompletion(mockFollowUpQuestion);
                }
                if (prompt.includes('score') || prompt.includes('evaluate')) {
                    return createMockCompletion(mockCandidateScore);
                }
                if (prompt.includes('parse') || prompt.includes('resume')) {
                    return createMockCompletion(mockParsedResume);
                }

                // Default response
                return createMockCompletion({ response: 'Mock response' });
            }),
        },
    },
};

// Mock the OpenAI module
export const mockOpenAIModule = {
    default: vi.fn().mockImplementation(() => mockOpenAIClient),
};
