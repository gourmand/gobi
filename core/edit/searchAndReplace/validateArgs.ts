import { IDE } from "../..";
import { GobiError, GobiErrorReason } from "../../util/errors";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export async function validateSearchAndReplaceFilepath(
  filepath: unknown,
  ide: IDE,
) {
  if (!filepath || typeof filepath !== "string") {
    throw new GobiError(
      GobiErrorReason.FindAndReplaceMissingFilepath,
      "filepath (string) is required",
    );
  }
  const resolvedFilepath = await resolveRelativePathInDir(filepath, ide);
  if (!resolvedFilepath) {
    throw new GobiError(
      GobiErrorReason.FileNotFound,
      `File ${filepath} does not exist`,
    );
  }
  return resolvedFilepath;
}
