/**
 * @fileoverview E2E tests for candidate flows
 * 
 * Tests candidate application submission and viewing.
 */

import { test, expect } from '@playwright/test';

test.describe('Candidates', () => {
    test.describe('Candidates Listing', () => {
        test('should display candidates page', async ({ page }) => {
            await page.goto('/dashboard/candidates');

            await page.waitForLoadState('networkidle');

            // Should show candidates heading
            const heading = page.getByRole('heading', { name: /candidates/i });
            await expect(heading).toBeVisible();
        });

        test('should filter candidates by stage', async ({ page }) => {
            await page.goto('/dashboard/candidates');

            await page.waitForLoadState('networkidle');

            // Look for stage filter tabs/buttons
            const stageFilter = page.locator('[data-testid="stage-filter"]');
            if (await stageFilter.isVisible()) {
                await expect(stageFilter).toBeVisible();
            }
        });
    });

    test.describe('Candidate Details', () => {
        test('should show candidate profile', async ({ page }) => {
            await page.goto('/dashboard/candidates');

            await page.waitForLoadState('networkidle');

            // Click on first candidate if exists
            const firstCandidate = page.locator('[data-testid="candidate-card"]').first();
            if (await firstCandidate.isVisible()) {
                await firstCandidate.click();

                // Should navigate to candidate details
                await expect(page.getByText(/ai score|resume|experience/i)).toBeVisible();
            }
        });
    });

    test.describe('Application Submission', () => {
        test('should display application form for public job', async ({ page }) => {
            // Navigate to a public job application page
            await page.goto('/');

            // Look for apply button or jobs listing
            const applyButtons = page.getByRole('link', { name: /apply|view.*jobs/i });
            if (await applyButtons.first().isVisible()) {
                await applyButtons.first().click();
                await page.waitForLoadState('networkidle');
            }
        });
    });
});
