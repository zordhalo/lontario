/**
 * @fileoverview E2E tests for authentication flows
 * 
 * Tests user registration, login, password reset using Playwright.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test.describe('Login Page', () => {
        test('should display login form', async ({ page }) => {
            await page.goto('/login');

            await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
            await expect(page.getByLabel(/email/i)).toBeVisible();
            await expect(page.getByLabel(/password/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
        });

        test('should show validation errors for empty form', async ({ page }) => {
            await page.goto('/login');

            await page.getByRole('button', { name: /sign in/i }).click();

            // Should show validation errors
            await expect(page.getByText(/email.*required/i)).toBeVisible();
        });

        test('should have link to registration page', async ({ page }) => {
            await page.goto('/login');

            const registerLink = page.getByRole('link', { name: /sign up|register|create account/i });
            await expect(registerLink).toBeVisible();
        });

        test('should have link to forgot password', async ({ page }) => {
            await page.goto('/login');

            const forgotLink = page.getByRole('link', { name: /forgot.*password/i });
            await expect(forgotLink).toBeVisible();
        });
    });

    test.describe('Registration Page', () => {
        test('should display registration form', async ({ page }) => {
            await page.goto('/register');

            await expect(page.getByRole('heading', { name: /sign up|create account|register/i })).toBeVisible();
            await expect(page.getByLabel(/email/i)).toBeVisible();
            await expect(page.getByLabel(/password/i).first()).toBeVisible();
        });

        test('should have link to login page', async ({ page }) => {
            await page.goto('/register');

            const loginLink = page.getByRole('link', { name: /sign in|log in/i });
            await expect(loginLink).toBeVisible();
        });
    });

    test.describe('Forgot Password Page', () => {
        test('should display password reset form', async ({ page }) => {
            await page.goto('/forgot-password');

            await expect(page.getByLabel(/email/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /reset|send|submit/i })).toBeVisible();
        });
    });
});
