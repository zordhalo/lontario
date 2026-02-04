/**
 * @fileoverview Accessibility tests using axe-core
 * 
 * Tests pages for WCAG compliance using axe-core/playwright.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
    test('landing page should have no accessibility violations', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('login page should have no accessibility violations', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('register page should have no accessibility violations', async ({ page }) => {
        await page.goto('/register');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check that h1 exists
        const h1 = page.locator('h1');
        await expect(h1.first()).toBeVisible();

        // Run heading-order rule specifically
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withRules(['heading-order'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have sufficient color contrast', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withRules(['color-contrast'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('form inputs should have labels', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withRules(['label'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('interactive elements should be keyboard accessible', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Tab through the page
        await page.keyboard.press('Tab');

        // Check that focus is visible
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
});
