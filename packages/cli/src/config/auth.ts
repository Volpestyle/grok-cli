/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from 'grok-cli-core';
import { loadEnvironment } from './settings.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();

  if (authMethod === AuthType.USE_GROK) {
    if (!process.env.GROK_API_KEY) {
      return 'GROK_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  // Legacy auth methods - not supported in Grok CLI
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.CLOUD_SHELL ||
    authMethod === AuthType.USE_GEMINI ||
    authMethod === AuthType.USE_VERTEX_AI
  ) {
    return 'This authentication method is not supported in Grok CLI. Please use a Grok API key.';
  }

  return 'Invalid auth method selected.';
};
