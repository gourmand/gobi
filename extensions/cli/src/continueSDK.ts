import { Gobi, GobiClient } from "@gourmanddev/sdk";
import chalk from "chalk";

import { env } from "./env.js";

/**
 * Initialize the Gobi SDK with the given parameters
 * @param apiKey - API key to use for authentication
 * @param assistantSlug - Slug of the assistant to use
 * @param organizationId - Optional organization ID
 * @returns Promise resolving to the Gobi SDK instance
 */
export async function initializeGobiSDK(
  apiKey: string | undefined,
  assistantSlug: string,
  organizationId?: string,
): Promise<GobiClient> {
  if (!apiKey) {
    console.error(chalk.red("Error: No API key provided for Gobi SDK"));
    throw new Error("No API key provided for Gobi SDK");
  }

  try {
    return await Gobi.from({
      apiKey,
      assistant: assistantSlug,
      organizationId,
      baseURL: env.apiBase,
    });
  } catch (error) {
    console.error(
      chalk.red("Error initializing Gobi SDK:"),
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
