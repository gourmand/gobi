import { Prompt } from "@gourmanddev/config-yaml";
import { SlashCommandWithSource } from "../../index";

export function convertPromptBlockToSlashCommand(
  prompt: Prompt,
): SlashCommandWithSource {
  return {
    name: prompt.name,
    description: prompt.description ?? "",
    prompt: prompt.prompt,
    source: "yaml-prompt-block",
    sourceFile: prompt.sourceFile,
  };
}
