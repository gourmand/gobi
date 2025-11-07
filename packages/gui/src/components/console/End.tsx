import {
  LLMInteractionCancel,
  LLMInteractionError,
  LLMInteractionSuccess,
} from "@gourmanddev/core";
import Expander from "./Expander";
import Message from "./Message";

export interface StartProps {
  item: LLMInteractionSuccess | LLMInteractionError | LLMInteractionCancel;
}

export default function Start({ item }: StartProps) {
  //  <div className="border-0 border-b-2 border-solid border-[color:var(--vscode-panel-border)]">
  switch (item.kind) {
    case "success":
      return <></>;
    case "error":
      return (
        <div>
          <span className="m-0.5 inline-block rounded-sm bg-[color:var(--vscode-statusBarItem-errorBackground)] p-0.5 text-[color:var(--vscode-statusBarItem-errorForeground)]">
            Error
          </span>
          {item.message}
        </div>
      );
      break;
    case "cancel":
      return (
        <div>
          <span className="m-0.5 inline-block rounded-sm bg-[color:var(--vscode-statusBarItem-warningBackground)] p-0.5 text-[color:var(--vscode-statusBarItem-warningForeground)]">
            Cancelled
          </span>
        </div>
      );
  }
}
