import { TODO } from "@gourmanddev/core/util";
import { MessageIde } from "@gourmanddev/core/protocol/messenger/messageIde";

export class IpcIde extends MessageIde {
  constructor(messenger: TODO) {
    super(messenger.request.bind(messenger), messenger.on.bind(messenger));
  }
}
