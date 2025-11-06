import { ContextItem, ToolExtras } from "../../index";

export type ToolImpl = (
  parameters: any,
  extras: ToolExtras,
) => Promise<ContextItem[]>;
