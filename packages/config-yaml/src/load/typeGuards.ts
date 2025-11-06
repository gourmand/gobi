import * as z from "zod";
import { blockItemWrapperSchema } from "../schemas/index.js";

const _blockItemWrapperSchema = blockItemWrapperSchema(z.object({}));
export type BlockItemWrapper = z.infer<typeof _blockItemWrapperSchema>;

export const isBlockItemWrapper = (
  block: unknown,
): block is BlockItemWrapper => {
  return _blockItemWrapperSchema.safeParse(block).success;
};
