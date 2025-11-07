import { Box, Text } from "ink";
import React, { useMemo } from "react";

// Array of helpful tips for Gobi CLI users
const GOBI_CLI_TIPS = [
  "Use `/help` to learn keyboard shortcuts",
  "Press Escape to pause the TUI and Enter to submit your input",
  "Use arrow keys (↑/↓) to navigate through your input history",
  'Multi-line input is supported by typing "\\" and pressing enter',
  "Use `gobi ls` or `/resume` to resume a previous conversation",
  'Run `gobi` (or `gi`) with the `-p` flag for headless mode. For example: `gobi -p "Generate a commit message for the current changes. Output _only_ the commit message and nothing else."`',
  "Use the /init slash command to generate an AGENTS.md file. This will help `gobi` understand your codebase and generate better responses.",
];

interface TipsDisplayProps {
  // No props needed - component handles its own randomization
}

/**
 * Randomly selects and displays a tip from the GOBI_CLI_TIPS array.
 * Should only be shown 1 in 5 times (20% chance).
 */
const TipsDisplay: React.FC<TipsDisplayProps> = () => {
  // Randomly select a tip, memoized to prevent changing on re-renders
  const randomTip = useMemo(
    () => GOBI_CLI_TIPS[Math.floor(Math.random() * GOBI_CLI_TIPS.length)],
    [],
  );

  return (
    <Box flexDirection="row" paddingX={1} paddingBottom={1}>
      <Text color="green" bold>
        * Tip:
      </Text>
      <Text color="dim" italic>
        {" "}
        {randomTip}
      </Text>
      <Text> </Text>
    </Box>
  );
};

/**
 * Determines whether to show a tip (1 in 5 chance, 20% probability)
 */
export function shouldShowTip(): boolean {
  return Math.random() < 0.2; // 20% chance (1 in 5)
}

export { GOBI_CLI_TIPS, TipsDisplay };
