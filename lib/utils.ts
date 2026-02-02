/**
 * @fileoverview Utility functions for Lontario - AI Hiring Platform
 * 
 * Contains helper functions for:
 * - CSS class merging (Tailwind CSS)
 * - Duration formatting
 * - UI styling helpers (difficulty colors, category icons)
 * 
 * @module lib/utils
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges CSS class names with Tailwind CSS conflict resolution
 * 
 * Combines clsx for conditional classes with tailwind-merge to handle
 * conflicting Tailwind utility classes (e.g., `p-4` and `p-2`).
 * 
 * @param inputs - Class values to merge (strings, arrays, objects)
 * @returns Merged class string with conflicts resolved
 * 
 * @example
 * // Basic usage
 * cn('p-4', 'bg-blue-500') // 'p-4 bg-blue-500'
 * 
 * @example
 * // With conditional classes
 * cn('btn', isActive && 'btn-active', { 'btn-disabled': disabled })
 * 
 * @example
 * // Tailwind conflict resolution
 * cn('p-4', 'p-2') // 'p-2' (later class wins)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a duration in minutes to a human-readable string
 * @param minutes - Duration in minutes
 * @returns Formatted string (e.g., "45 min" or "1h 15m")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Returns Tailwind CSS classes for difficulty badge styling
 * @param difficulty - Question difficulty level
 * @returns Tailwind class string
 */
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "easy":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
    case "hard":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
  }
}

/**
 * Returns the Lucide icon name for a question category
 * @param category - Question category
 * @returns Icon name string
 */
export function getCategoryIcon(category: string): string {
  switch (category) {
    case "technical":
      return "code"
    case "behavioral":
      return "users"
    case "system-design":
      return "layout"
    case "problem-solving":
      return "lightbulb"
    case "culture-fit":
      return "heart"
    default:
      return "help-circle"
  }
}

/**
 * Returns a display label for a question category
 * @param category - Question category
 * @returns Human-readable category label
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case "technical":
      return "Technical"
    case "behavioral":
      return "Behavioral"
    case "system-design":
      return "System Design"
    case "problem-solving":
      return "Problem Solving"
    case "culture-fit":
      return "Culture Fit"
    default:
      return category
  }
}

/**
 * Gets the application base URL for generating links
 * 
 * Priority order:
 * 1. NEXT_PUBLIC_APP_URL - Explicit app URL (use for custom domains)
 * 2. VERCEL_URL - Automatically set by Vercel for all deployments
 * 3. localhost:3000 - Fallback for local development
 * 
 * @returns The base URL without trailing slash
 * 
 * @example
 * getAppUrl() // 'https://myapp.vercel.app' or 'http://localhost:3000'
 */
export function getAppUrl(): string {
  // Explicit app URL takes priority (for custom domains)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  // Vercel automatically provides this in all deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback for local development
  return 'http://localhost:3000';
}
