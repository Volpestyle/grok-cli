/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  FinishReason,
  // Role,
  Tool,
  // FunctionDeclaration,
} from '@google/genai';
import { ContentGenerator } from './contentGenerator.js';

export class GrokContentGenerator implements ContentGenerator {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
    });
    this.model = model;
  }

  private convertToOpenAIMessages(
    contents: Content[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const content of contents) {
      const role = content.role === 'model' ? 'assistant' : content.role;
      const messageParts: any[] = [];
      const toolCalls: any[] = [];
      let hasText = false;

      for (const part of content.parts || []) {
        if ('text' in part) {
          messageParts.push(part.text);
          hasText = true;
        } else if ('inlineData' in part && part.inlineData) {
          messageParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            },
          });
        } else if ('functionCall' in part && part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
        } else if ('functionResponse' in part && part.functionResponse) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(part.functionResponse.response),
            tool_call_id: part.functionResponse.name || '',
          });
          continue;
        }
      }

      if (hasText || messageParts.length > 0) {
        const message: any = {
          role: role as 'system' | 'user' | 'assistant',
        };

        if (messageParts.length === 1 && typeof messageParts[0] === 'string') {
          message.content = messageParts[0];
        } else if (messageParts.length > 0) {
          message.content = messageParts;
        }

        if (toolCalls.length > 0) {
          message.tool_calls = toolCalls;
        }

        messages.push(message);
      }
    }

    return messages;
  }

  private convertFromOpenAIResponse(
    response: OpenAI.Chat.ChatCompletion,
  ): GenerateContentResponse {
    const choice = response.choices[0];
    const finishReason = this.mapFinishReason(choice.finish_reason);
    const parts: Part[] = [];

    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function) {
          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments || '{}'),
            },
          });
        }
      }
    }

    const result = {
      candidates: [
        {
          content: {
            role: 'model' as const,
            parts,
          },
          finishReason,
          safetyRatings: [],
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: response.usage?.prompt_tokens || 0,
        candidatesTokenCount: response.usage?.completion_tokens || 0,
        totalTokenCount: response.usage?.total_tokens || 0,
      },
    };

    // Add convenience methods as getter properties
    Object.defineProperty(result, 'text', {
      get: () =>
        parts
          .filter((p) => 'text' in p)
          .map((p) => p.text)
          .join(''),
    });
    Object.defineProperty(result, 'data', {
      get: () =>
        parts.filter((p) => 'inlineData' in p).map((p) => p.inlineData),
    });
    Object.defineProperty(result, 'functionCalls', {
      get: () =>
        parts.filter((p) => 'functionCall' in p).map((p) => p.functionCall),
    });
    Object.defineProperty(result, 'executableCode', {
      get: () =>
        parts.filter((p) => 'executableCode' in p).map((p) => p.executableCode),
    });
    Object.defineProperty(result, 'codeExecutionResult', {
      get: () =>
        parts
          .filter((p) => 'codeExecutionResult' in p)
          .map((p) => p.codeExecutionResult),
    });

    return result as unknown as GenerateContentResponse;
  }

  private mapFinishReason(openAIReason: string | null): FinishReason {
    switch (openAIReason) {
      case 'stop':
        return FinishReason.STOP;
      case 'length':
        return FinishReason.MAX_TOKENS;
      case 'content_filter':
        return FinishReason.SAFETY;
      default:
        return FinishReason.OTHER;
    }
  }

  private convertTools(tools?: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
    if (!tools || tools.length === 0) {
      return [];
    }

    const openAITools: OpenAI.Chat.ChatCompletionTool[] = [];

    // Convert Gemini Type enum values to OpenAI/xAI lowercase strings
    const convertSchema = (schema: any): any => {
      if (!schema) return {};
      
      const result: any = {};
      
      for (const key in schema) {
        if (key === 'type') {
          // Type enum might be a number (enum value) or string
          const typeValue = schema[key];
          if (typeof typeValue === 'number') {
            // Map numeric enum values to string types
            // Based on @google/genai Type enum:
            // STRING = 1, NUMBER = 2, INTEGER = 3, BOOLEAN = 4, ARRAY = 5, OBJECT = 6
            const typeMap: Record<number, string> = {
              1: 'string',
              2: 'number',
              3: 'integer',
              4: 'boolean',
              5: 'array',
              6: 'object'
            };
            result[key] = typeMap[typeValue] || 'string';
          } else if (typeof typeValue === 'string') {
            // Convert uppercase TYPE values to lowercase
            // e.g., "STRING" -> "string", "OBJECT" -> "object", "ARRAY" -> "array"
            result[key] = typeValue.toLowerCase();
          } else {
            result[key] = 'string'; // Default fallback
          }
        } else if (key === 'properties' && typeof schema[key] === 'object') {
          // Recursively convert nested properties
          result[key] = {};
          for (const propKey in schema[key]) {
            result[key][propKey] = convertSchema(schema[key][propKey]);
          }
        } else if (key === 'items' && typeof schema[key] === 'object') {
          // Handle array items
          result[key] = convertSchema(schema[key]);
        } else if (key === 'required' || key === 'description') {
          // Keep required and description fields
          result[key] = schema[key];
        } else if (key === 'minLength' || key === 'minItems' || key === 'maxLength' || 
                   key === 'maxItems' || key === 'minimum' || key === 'maximum') {
          // Skip these for xAI - they might not support all JSON Schema features
        } else if (key === 'default') {
          // Skip default values - xAI might not support them
        } else {
          // Skip other unknown fields
        }
      }
      
      return result;
    };

    for (const tool of tools) {
      if (tool.functionDeclarations) {
        for (const func of tool.functionDeclarations) {
          const convertedTool: OpenAI.Chat.ChatCompletionTool = {
            type: 'function' as const,
            function: {
              name: func.name || '',
              description: func.description || '',
              parameters: convertSchema(func.parameters) || {
                type: 'object',
                properties: {},
              },
            },
          };
          
          
          openAITools.push(convertedTool);
        }
      }
    }

    return openAITools;
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const messages = this.convertToOpenAIMessages(contents as Content[]);
    const tools = request.config?.tools
      ? this.convertTools(request.config.tools as Tool[])
      : [];

    const apiRequest = {
      model: request.model || this.model,
      messages,
      temperature: request.config?.temperature,
      max_tokens: request.config?.maxOutputTokens,
      top_p: request.config?.topP,
      stream: false,
      ...(tools.length > 0 && { tools }),
      ...(request.config as any)?.tool_choice && { tool_choice: (request.config as any).tool_choice },
      ...(request.config as any)?.response_format && { response_format: (request.config as any).response_format },
      ...(request.config as any)?.reasoning_effort && { reasoning_effort: (request.config as any).reasoning_effort },
    };
    
    try {
      const response = await this.openai.chat.completions.create(apiRequest);
      return this.convertFromOpenAIResponse(response);
    } catch (error: any) {
      throw error;
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this._generateContentStream(request);
  }

  private async *_generateContentStream(
    request: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse> {
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const messages = this.convertToOpenAIMessages(contents as Content[]);
    const tools = request.config?.tools
      ? this.convertTools(request.config.tools as Tool[])
      : [];

    const apiRequest = {
      model: request.model || this.model,
      messages,
      temperature: request.config?.temperature,
      max_tokens: request.config?.maxOutputTokens,
      top_p: request.config?.topP,
      stream: true,
      ...(tools.length > 0 && { tools }),
      ...(request.config as any)?.tool_choice && { tool_choice: (request.config as any).tool_choice },
      ...(request.config as any)?.response_format && { response_format: (request.config as any).response_format },
      ...(request.config as any)?.reasoning_effort && { reasoning_effort: (request.config as any).reasoning_effort },
    };
    
    let stream;
    try {
      stream = await this.openai.chat.completions.create(apiRequest);
    } catch (error) {
      throw error;
    }

    let usage: OpenAI.CompletionUsage | undefined;

    for await (const chunk of stream as any) {
      const choice = chunk.choices[0];
      const parts: Part[] = [];

      if (chunk.usage) {
        usage = chunk.usage;
      }

      if (choice?.delta?.content) {
        parts.push({ text: choice.delta.content });
      }

      if (choice?.delta?.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          if (toolCall.function) {
            parts.push({
              functionCall: {
                name: toolCall.function.name || '',
                args: toolCall.function.arguments
                  ? JSON.parse(toolCall.function.arguments)
                  : {},
              },
            });
          }
        }
      }

      if (parts.length > 0) {
        const result = {
          candidates: [
            {
              content: {
                role: 'model' as const,
                parts,
              },
              finishReason: choice.finish_reason
                ? this.mapFinishReason(choice.finish_reason)
                : ('OTHER' as FinishReason),
              safetyRatings: [],
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: usage?.prompt_tokens || 0,
            candidatesTokenCount: usage?.completion_tokens || 0,
            totalTokenCount: usage?.total_tokens || 0,
          },
        };

        // Add convenience methods as getter properties
        Object.defineProperty(result, 'text', {
          get: () =>
            parts
              .filter((p) => 'text' in p)
              .map((p) => p.text)
              .join(''),
        });
        Object.defineProperty(result, 'data', {
          get: () =>
            parts.filter((p) => 'inlineData' in p).map((p) => p.inlineData),
        });
        Object.defineProperty(result, 'functionCalls', {
          get: () =>
            parts.filter((p) => 'functionCall' in p).map((p) => p.functionCall),
        });
        Object.defineProperty(result, 'executableCode', {
          get: () =>
            parts
              .filter((p) => 'executableCode' in p)
              .map((p) => p.executableCode),
        });
        Object.defineProperty(result, 'codeExecutionResult', {
          get: () =>
            parts
              .filter((p) => 'codeExecutionResult' in p)
              .map((p) => p.codeExecutionResult),
        });

        yield result as unknown as GenerateContentResponse;
      }
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Grok API doesn't have a direct token counting endpoint
    // We'll estimate based on a more accurate calculation:
    // - Average English word is ~4.7 characters
    // - Average token is ~0.75 words
    // - So approximately 1 token = 3.5 characters
    let totalChars = 0;
    let imageCount = 0;

    const contents = Array.isArray(request.contents) ? request.contents : [request.contents];
    for (const content of contents as Content[]) {
      for (const part of content.parts || []) {
        if ('text' in part && part.text) {
          totalChars += part.text.length;
        } else if ('inlineData' in part && part.inlineData) {
          // Rough estimate for images: ~750 tokens per image
          imageCount++;
        }
      }
    }

    const textTokens = Math.ceil(totalChars / 3.5);
    const imageTokens = imageCount * 750;
    const estimatedTokens = textTokens + imageTokens;

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Grok doesn't support embeddings directly
    throw new Error(
      'Embeddings are not supported by Grok API. ' +
        'Consider using a dedicated embedding service like OpenAI or Cohere for embedding generation.',
    );
  }
}
