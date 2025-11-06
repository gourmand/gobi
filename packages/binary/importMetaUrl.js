// https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
import { pathToFileURL } from "node:url";
export const importMetaUrl = pathToFileURL(import.meta.url);
