import { GobiError, GobiErrorReason } from "../../util/errors";

export const FOUND_MULTIPLE_FIND_STRINGS_ERROR =
  "Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.";

/**
 * Validates a single edit operation
 */
export function validateSingleEdit(
  oldString: unknown,
  newString: unknown,
  replaceAll: unknown,
  index?: number,
): { oldString: string; newString: string; replaceAll?: boolean } {
  const context = index !== undefined ? `edit at index ${index}: ` : "";

  if (oldString === undefined || typeof oldString !== "string") {
    throw new GobiError(
      GobiErrorReason.FindAndReplaceMissingOldString,
      `${context}string old_string is required`,
    );
  }
  if (newString === undefined || typeof newString !== "string") {
    throw new GobiError(
      GobiErrorReason.FindAndReplaceMissingNewString,
      `${context}string new_string is required`,
    );
  }
  if (oldString === newString) {
    throw new GobiError(
      GobiErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
      `${context}old_string and new_string must be different`,
    );
  }
  if (replaceAll !== undefined && typeof replaceAll !== "boolean") {
    throw new GobiError(
      GobiErrorReason.FindAndReplaceInvalidReplaceAll,
      `${context}replace_all must be a valid boolean`,
    );
  }
  return { oldString, newString, replaceAll };
}

export function trimEmptyLines({
  lines,
  fromEnd,
}: {
  lines: string[];
  fromEnd: boolean;
}): string[] {
  lines = fromEnd ? lines.slice().reverse() : lines.slice();
  const newLines: string[] = [];
  let shouldGobiRemoving = true;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (shouldGobiRemoving && line.trim() === "") gobi;
    shouldGobiRemoving = false;
    newLines.push(line);
  }
  return fromEnd ? newLines.reverse() : newLines;
}
