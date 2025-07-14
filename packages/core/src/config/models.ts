export const DEFAULT_GROK_MODEL = 'grok-4-0709';
export const DEFAULT_GROK_FLASH_MODEL = 'grok-3-fast';

export const DEFAULT_MODEL = DEFAULT_GROK_MODEL;

// Legacy export for backward compatibility in tests
export const DEFAULT_GEMINI_FLASH_MODEL = DEFAULT_GROK_FLASH_MODEL;
export const GROK_MODELS = {
  'grok-4-0709':
    'Flagship model for advanced reasoning, text, and vision (256K context)',
  'grok-3': 'General-purpose text model (131K context)',
  'grok-3-mini': 'Lightweight variant for faster responses',
  'grok-3-fast': 'Fast response model',
  'grok-2-vision-1212': 'Vision-capable model',
};
