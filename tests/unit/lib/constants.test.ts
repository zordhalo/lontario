import { describe, it, expect } from 'vitest';
import {
    PIPELINE_STAGES,
    KANBAN_STAGES,
    JOB_STATUS,
    JOB_LEVELS,
    AI_SCORE_THRESHOLDS,
    QUESTION_CATEGORIES,
} from '@/lib/constants';

describe('PIPELINE_STAGES', () => {
    it('is a non-empty array', () => {
        expect(PIPELINE_STAGES.length).toBeGreaterThan(0);
    });

    it('each stage has id, label, color, and description', () => {
        for (const stage of PIPELINE_STAGES) {
            expect(stage).toHaveProperty('id');
            expect(stage).toHaveProperty('label');
            expect(stage).toHaveProperty('color');
            expect(stage).toHaveProperty('description');
        }
    });

    it('includes applied and hired stages', () => {
        const ids = PIPELINE_STAGES.map((s) => s.id);
        expect(ids).toContain('applied');
        expect(ids).toContain('hired');
    });

    it('all color values are Tailwind bg- classes', () => {
        for (const stage of PIPELINE_STAGES) {
            expect(stage.color).toMatch(/^bg-/);
        }
    });
});

describe('KANBAN_STAGES', () => {
    it('is a non-empty array', () => {
        expect(KANBAN_STAGES.length).toBeGreaterThan(0);
    });

    it('each kanban stage has id and label', () => {
        for (const stage of KANBAN_STAGES) {
            expect(stage).toHaveProperty('id');
            expect(stage).toHaveProperty('label');
        }
    });
});

describe('JOB_STATUS', () => {
    it('contains active and closed keys', () => {
        expect(JOB_STATUS).toHaveProperty('active');
        expect(JOB_STATUS).toHaveProperty('closed');
    });

    it('each status entry has a label and color', () => {
        for (const [, entry] of Object.entries(JOB_STATUS)) {
            expect(entry).toHaveProperty('label');
            expect(entry).toHaveProperty('color');
        }
    });
});

describe('JOB_LEVELS', () => {
    it('contains at least one level', () => {
        expect(JOB_LEVELS.length).toBeGreaterThan(0);
    });

    it('each level has value and label', () => {
        for (const level of JOB_LEVELS) {
            expect(level).toHaveProperty('value');
            expect(level).toHaveProperty('label');
        }
    });

    it('includes mid and senior', () => {
        const values = JOB_LEVELS.map((l) => l.value);
        expect(values).toContain('mid');
        expect(values).toContain('senior');
    });
});

describe('AI_SCORE_THRESHOLDS', () => {
    it('defines excellent, good, and moderate thresholds', () => {
        expect(AI_SCORE_THRESHOLDS).toHaveProperty('excellent');
        expect(AI_SCORE_THRESHOLDS).toHaveProperty('good');
        expect(AI_SCORE_THRESHOLDS).toHaveProperty('moderate');
    });

    it('excellent > good > moderate', () => {
        expect(AI_SCORE_THRESHOLDS.excellent).toBeGreaterThan(AI_SCORE_THRESHOLDS.good);
        expect(AI_SCORE_THRESHOLDS.good).toBeGreaterThan(AI_SCORE_THRESHOLDS.moderate);
    });

    it('all thresholds are numbers between 0 and 100', () => {
        for (const [, value] of Object.entries(AI_SCORE_THRESHOLDS)) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
        }
    });
});

describe('QUESTION_CATEGORIES', () => {
    it('is a non-empty array', () => {
        expect(QUESTION_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('includes technical and behavioral', () => {
        const values = QUESTION_CATEGORIES.map((c) => c.value);
        expect(values).toContain('technical');
        expect(values).toContain('behavioral');
    });

    it('each category has value and label', () => {
        for (const cat of QUESTION_CATEGORIES) {
            expect(cat).toHaveProperty('value');
            expect(cat).toHaveProperty('label');
        }
    });
});
