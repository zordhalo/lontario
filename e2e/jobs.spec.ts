/**
 * @fileoverview E2E tests for job management flows
 * 
 * Tests job listing, viewing, and creation using Playwright.
 */

import { test, expect } from '@playwright/test';

test.describe('Jobs', () => {
    test.describe('Jobs Listing', () => {
        test('should display jobs listing page', async ({ page }) => {
            await page.goto('/dashboard/jobs');

            // Wait for page to load
            await page.waitForLoadState('networkidle');

            // Should show jobs heading or table
            const jobsHeading = page.getByRole('heading', { name: /jobs/i });
            await expect(jobsHeading).toBeVisible();
        });

        test('should have create job button', async ({ page }) => {
            await page.goto('/dashboard/jobs');

            const createButton = page.getByRole('button', { name: /create|new|add/i });
            await expect(createButton).toBeVisible();
        });
    });

    test.describe('Job Details', () => {
        test('should navigate to job details from listing', async ({ page }) => {
            await page.goto('/dashboard/jobs');

            // Wait for jobs to load
            await page.waitForLoadState('networkidle');

            // Click on first job if exists
            const firstJobLink = page.locator('[data-testid="job-card"]').first();
            if (await firstJobLink.isVisible()) {
                await firstJobLink.click();

                // Should show job details
                await expect(page.getByRole('heading')).toBeVisible();
            }
        });
    });

    test.describe('Create Job', () => {
        test('should display job creation form', async ({ page }) => {
            await page.goto('/dashboard/jobs/new');

            // Should show form elements
            await expect(page.getByLabel(/title/i)).toBeVisible();
            await expect(page.getByLabel(/department/i)).toBeVisible();
        });

        test('should validate required fields', async ({ page }) => {
            await page.goto('/dashboard/jobs/new');

            // Try to submit empty form
            const submitButton = page.getByRole('button', { name: /create|save|submit/i });
            if (await submitButton.isVisible()) {
                await submitButton.click();

                // Should show validation errors
                await expect(page.getByText(/required/i)).toBeVisible();
            }
        });
    });
});
