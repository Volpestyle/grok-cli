/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  GoogleGenAI,
} from '@google/genai';
// import OpenAI from 'openai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GROK_MODEL } from '../config/models.js';
import { GrokContentGenerator } from './grokContentGenerator.js';
import { Config } from '../config/config.js';
import { getEffectiveModel } from './modelCheck.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  getTier?(): Promise<UserTierId | undefined>;
}

export enum AuthType {
  USE_GROK = 'grok-api-key',
  // Legacy auth types kept for compatibility
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
};

export async function createContentGeneratorConfig(
  model: string | undefined,
  authType: AuthType | undefined,
): Promise<ContentGeneratorConfig> {
  const grokApiKey = process.env.GROK_API_KEY || undefined;

  // Use runtime model from config if available, otherwise fallback to parameter or default
  const effectiveModel = model || DEFAULT_GROK_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
  };

  if (authType === AuthType.USE_GROK && grokApiKey) {
    contentGeneratorConfig.apiKey = grokApiKey;
    contentGeneratorConfig.vertexai = false;
    return contentGeneratorConfig;
  }

  // Legacy auth types - not supported in Grok CLI
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL ||
    authType === AuthType.USE_GEMINI ||
    authType === AuthType.USE_VERTEX_AI
  ) {
    throw new Error(
      'This authentication method is not supported in Grok CLI. Please use a Grok API key.',
    );
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GrokCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };
  if (config.authType === AuthType.USE_GROK && config.apiKey) {
    return new GrokContentGenerator(config.apiKey, config.model);
  }

  // Legacy auth types - not supported in Grok CLI
  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL ||
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    throw new Error(
      'This authentication method is not supported in Grok CLI. Please use a Grok API key.',
    );
  }

  throw new Error(
    `Error creating contentGenerator: Invalid or missing authType: ${config.authType}`,
  );
}
