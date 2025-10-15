import fs from "fs";
import { IDE } from "..";
import { getGlobalGobiIgnorePath } from "../util/paths";
import { gitIgArrayFromFile } from "./ignore";

export const getGlobalGobiIgArray = () => {
  const contents = fs.readFileSync(getGlobalGobiIgnorePath(), "utf8");
  return gitIgArrayFromFile(contents);
};

export const getWorkspaceGobiIgArray = async (ide: IDE) => {
  const dirs = await ide.getWorkspaceDirs();
  return await dirs.reduce(
    async (accPromise, dir) => {
      const acc = await accPromise;
      try {
        const contents = await ide.readFile(`${dir}/.gobiignore`);
        return [...acc, ...gitIgArrayFromFile(contents)];
      } catch (err) {
        console.error(err);
        return acc;
      }
    },
    Promise.resolve([] as string[]),
  );
};
