/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text , useInput } from 'ink';
import Link from 'ink-link';
import { Colors } from '../colors.js';

interface GrokPrivacyNoticeProps {
  onExit: () => void;
}

export const GrokPrivacyNotice = ({ onExit }: GrokPrivacyNoticeProps) => {
  useInput((_input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  return (
    <Box flexDirection="column" width="100%" gap={1}>
      <Text bold color={Colors.AccentPurple}>
        Data Usage with Grok API
      </Text>
      <Text wrap="wrap">
        When you use Grok CLI with a Grok API key, your prompts and responses
        are processed through xAI's servers.
      </Text>
      <Text wrap="wrap">
        By using this tool, you agree to xAI's Terms of Service and Privacy
        Policy:
      </Text>
      <Box flexDirection="column" paddingLeft={2}>
        <Link url="https://x.ai/legal/terms-of-service">
          <Text color={Colors.AccentCyan}>• xAI Terms of Service</Text>
        </Link>
        <Link url="https://x.ai/legal/privacy-policy">
          <Text color={Colors.AccentCyan}>• xAI Privacy Policy</Text>
        </Link>
      </Box>
      <Text wrap="wrap">
        For more information about Grok models and capabilities, visit:
      </Text>
      <Box paddingLeft={2}>
        <Link url="https://x.ai/api">
          <Text color={Colors.AccentCyan}>• xAI API Documentation</Text>
        </Link>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>[Press ESC to continue]</Text>
      </Box>
    </Box>
  );
};
