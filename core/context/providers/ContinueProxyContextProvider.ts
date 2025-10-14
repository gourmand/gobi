import { getControlPlaneEnv } from "../../control-plane/env.js";
import {
    ContextItem,
    ContextProviderDescription,
    ContextProviderExtras,
    ContextSubmenuItem,
    LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class GobiProxyContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "gobi-proxy",
    displayTitle: "Gobi Proxy",
    description: "Retrieve a context item from a Gobi for Teams add-on",
    type: "submenu",
  };

  workOsAccessToken: string | undefined = undefined;

  override get description(): ContextProviderDescription {
    return {
      title:
        this.options.title || GobiProxyContextProvider.description.title,
      displayTitle:
        this.options.displayTitle ||
        this.options.name ||
        GobiProxyContextProvider.description.displayTitle,
      description:
        this.options.description ||
        GobiProxyContextProvider.description.description,
      type: this.options.type || GobiProxyContextProvider.description.type,
    };
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const env = await getControlPlaneEnv(args.ide.getIdeSettings());
    const response = await args.fetch(
      new URL(`/proxy/context/${this.options.id}/list`, env.CONTROL_PLANE_URL),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.workOsAccessToken}`,
        },
      },
    );
    const data = await response.json();
    return data.items;
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const env = await getControlPlaneEnv(extras.ide.getIdeSettings());
    const response = await extras.fetch(
      new URL(
        `/proxy/context/${this.options.id}/retrieve`,
        env.CONTROL_PLANE_URL,
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.workOsAccessToken}`,
        },
        body: JSON.stringify({
          query: query || "",
          fullInput: extras.fullInput,
        }),
      },
    );

    const items: any = await response.json();
    return items;
  }
}

export default GobiProxyContextProvider;
