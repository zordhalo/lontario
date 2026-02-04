/**
 * @fileoverview Unit tests for lib/utils.ts
 * 
 * Tests all utility functions including:
 * - cn() class name merging
 * - formatDuration() time formatting
 * - getDifficultyColor() difficulty styling
 * - getCategoryIcon() category icons
 * - getCategoryLabel() category labels
 * - getAppUrl() app URL detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    cn,
    formatDuration,
    getDifficultyColor,
    getCategoryIcon,
    getCategoryLabel,
    getAppUrl,
} from '@/lib/utils';

describe('cn (class name merger)', () => {
    it('should merge simple class names', () => {
        expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
        expect(cn('base', true && 'active')).toBe('base active');
        expect(cn('base', false && 'active')).toBe('base');
    });

    it('should handle object notation', () => {
        expect(cn('base', { active: true, disabled: false })).toBe('base active');
    });

    it('should resolve Tailwind conflicts (later class wins)', () => {
        expect(cn('p-4', 'p-2')).toBe('p-2');
        expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
        expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    });

    it('should handle undefined and null values', () => {
        expect(cn('base', undefined, null, 'end')).toBe('base end');
    });

    it('should handle array inputs', () => {
        expect(cn(['class1', 'class2'])).toBe('class1 class2');
    });

    it('should handle empty inputs', () => {
        expect(cn()).toBe('');
        expect(cn('')).toBe('');
    });
});

describe('formatDuration', () => {
    it('should format minutes less than 60', () => {
        expect(formatDuration(0)).toBe('0 min');
        expect(formatDuration(1)).toBe('1 min');
        expect(formatDuration(30)).toBe('30 min');
        expect(formatDuration(59)).toBe('59 min');
    });

    it('should format exact hours', () => {
        expect(formatDuration(60)).toBe('1h');
        expect(formatDuration(120)).toBe('2h');
        expect(formatDuration(180)).toBe('3h');
    });

    it('should format hours with remaining minutes', () => {
        expect(formatDuration(65)).toBe('1h 5m');
        expect(formatDuration(90)).toBe('1h 30m');
        expect(formatDuration(135)).toBe('2h 15m');
    });

    it('should handle large durations', () => {
        expect(formatDuration(600)).toBe('10h');
        expect(formatDuration(615)).toBe('10h 15m');
    });
});

describe('getDifficultyColor', () => {
    it('should return green classes for easy difficulty', () => {
        const result = getDifficultyColor('easy');
        expect(result).toContain('green');
        expect(result).toContain('bg-green-100');
        expect(result).toContain('text-green-800');
    });

    it('should return yellow classes for medium difficulty', () => {
        const result = getDifficultyColor('medium');
        expect(result).toContain('yellow');
        expect(result).toContain('bg-yellow-100');
        expect(result).toContain('text-yellow-800');
    });

    it('should return red classes for hard difficulty', () => {
        const result = getDifficultyColor('hard');
        expect(result).toContain('red');
        expect(result).toContain('bg-red-100');
        expect(result).toContain('text-red-800');
    });

    it('should return gray classes for unknown difficulty', () => {
        const result = getDifficultyColor('unknown');
        expect(result).toContain('gray');
        expect(result).toContain('bg-gray-100');
    });

    it('should include dark mode variants', () => {
        const result = getDifficultyColor('easy');
        expect(result).toContain('dark:');
    });
});

describe('getCategoryIcon', () => {
    it('should return code icon for technical', () => {
        expect(getCategoryIcon('technical')).toBe('code');
    });

    it('should return users icon for behavioral', () => {
        expect(getCategoryIcon('behavioral')).toBe('users');
    });

    it('should return layout icon for system-design', () => {
        expect(getCategoryIcon('system-design')).toBe('layout');
    });

    it('should return lightbulb icon for problem-solving', () => {
        expect(getCategoryIcon('problem-solving')).toBe('lightbulb');
    });

    it('should return heart icon for culture-fit', () => {
        expect(getCategoryIcon('culture-fit')).toBe('heart');
    });

    it('should return help-circle icon for unknown categories', () => {
        expect(getCategoryIcon('unknown')).toBe('help-circle');
        expect(getCategoryIcon('')).toBe('help-circle');
    });
});

describe('getCategoryLabel', () => {
    it('should return proper labels for known categories', () => {
        expect(getCategoryLabel('technical')).toBe('Technical');
        expect(getCategoryLabel('behavioral')).toBe('Behavioral');
        expect(getCategoryLabel('system-design')).toBe('System Design');
        expect(getCategoryLabel('problem-solving')).toBe('Problem Solving');
        expect(getCategoryLabel('culture-fit')).toBe('Culture Fit');
    });

    it('should return the input for unknown categories', () => {
        expect(getCategoryLabel('unknown')).toBe('unknown');
        expect(getCategoryLabel('custom-category')).toBe('custom-category');
    });
});

describe('getAppUrl', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset env vars before each test
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        // Restore original env
        vi.unstubAllEnvs();
    });

    it('should prioritize NEXT_PUBLIC_APP_URL', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://myapp.com');
        vi.stubEnv('VERCEL_URL', 'myapp.vercel.app');
        expect(getAppUrl()).toBe('https://myapp.com');
    });

    it('should remove trailing slash from NEXT_PUBLIC_APP_URL', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://myapp.com/');
        expect(getAppUrl()).toBe('https://myapp.com');
    });

    it('should use VERCEL_URL when NEXT_PUBLIC_APP_URL is not set', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        vi.stubEnv('VERCEL_URL', 'myapp.vercel.app');
        expect(getAppUrl()).toBe('https://myapp.vercel.app');
    });

    it('should fallback to localhost when no env vars are set', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        vi.stubEnv('VERCEL_URL', '');
        expect(getAppUrl()).toBe('http://localhost:3000');
    });
});
