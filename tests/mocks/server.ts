/**
 * @fileoverview MSW server setup for Node.js testing environment
 * 
 * This file creates an MSW server instance for use in Vitest tests.
 * The server intercepts outgoing requests and returns mock responses.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create MSW server with all handlers
export const server = setupServer(...handlers);
