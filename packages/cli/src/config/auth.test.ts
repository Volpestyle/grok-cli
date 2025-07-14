/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from 'grok-cli-core';
import { vi } from 'vitest';
import { validateAuthMethod } from './auth.js';

vi.mock('./settings.js', () => ({
  loadEnvironment: vi.fn(),
}));

describe('validateAuthMethod', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return error for LOGIN_WITH_GOOGLE', () => {
    expect(validateAuthMethod(AuthType.LOGIN_WITH_GOOGLE)).toBe(
      'This authentication method is not supported in Grok CLI. Please use a Grok API key.'
    );
  });

  it('should return error for CLOUD_SHELL', () => {
    expect(validateAuthMethod(AuthType.CLOUD_SHELL)).toBe(
      'This authentication method is not supported in Grok CLI. Please use a Grok API key.'
    );
  });

  describe('USE_GEMINI', () => {
    it('should return error for unsupported auth method', () => {
      expect(validateAuthMethod(AuthType.USE_GEMINI)).toBe(
        'This authentication method is not supported in Grok CLI. Please use a Grok API key.',
      );
    });
  });

  describe('USE_VERTEX_AI', () => {
    it('should return error for unsupported auth method', () => {
      expect(validateAuthMethod(AuthType.USE_VERTEX_AI)).toBe(
        'This authentication method is not supported in Grok CLI. Please use a Grok API key.',
      );
    });
  });

  describe('USE_GROK', () => {
    it('should return null if GROK_API_KEY is set', () => {
      process.env.GROK_API_KEY = 'test-key';
      expect(validateAuthMethod(AuthType.USE_GROK)).toBeNull();
    });

    it('should return an error message if GROK_API_KEY is not set', () => {
      expect(validateAuthMethod(AuthType.USE_GROK)).toBe(
        'GROK_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!',
      );
    });
  });

  it('should return an error message for an invalid auth method', () => {
    expect(validateAuthMethod('invalid-method')).toBe(
      'Invalid auth method selected.',
    );
  });
});
