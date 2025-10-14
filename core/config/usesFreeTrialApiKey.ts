import { decodeSecretLocation, SecretType } from "@gourmanddev/config-yaml";
import { BrowserSerializedGobiConfig, ModelDescription } from "..";

/**
 * Helper function to determine if the config uses an API key that relies on Gobi credits (free trial or models add-on)
 * @param config The serialized config object
 * @returns true if the config is using any free trial models
 */
export function usesCreditsBasedApiKey(
  config: BrowserSerializedGobiConfig | null,
): boolean {
  if (!config) {
    return false;
  }

  // Check if the currently selected chat model uses free-trial provider
  const modelsByRole = config.modelsByRole;
  const allModels = [...Object.values(modelsByRole)].flat();

  // Check if any of the chat models use free-trial provider
  try {
    const hasFreeTrial = allModels?.some(modelUsesCreditsBasedApiKey);

    return hasFreeTrial;
  } catch (e) {
    console.error("Error checking for free trial API key:", e);
  }

  return false;
}

const modelUsesCreditsBasedApiKey = (model: ModelDescription) => {
  if (!model.apiKeyLocation) {
    return false;
  }

  const secretType = decodeSecretLocation(model.apiKeyLocation).secretType;

  return secretType === SecretType.FreeTrial;
};
