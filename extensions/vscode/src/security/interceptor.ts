import { BatchInterceptor } from "@mswjs/interceptors";
import { ClientRequestInterceptor } from "@mswjs/interceptors/ClientRequest";
import { FetchInterceptor } from "@mswjs/interceptors/fetch";
import { XMLHttpRequestInterceptor } from "@mswjs/interceptors/XMLHttpRequest";

let interceptor: BatchInterceptor<[ClientRequestInterceptor, FetchInterceptor, XMLHttpRequestInterceptor]> | null = null;

const ALLOW_LIST: RegExp[] = [/^https:\/\/(.*\.)?bedrock.*\.amazonaws\.com/i];

function isAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr).toString();
    return ALLOW_LIST.some((rx) => rx.test(u));
  } catch (err) {
    console.error("HTTP Interceptor: invalid URL: %s %s", urlStr, err);
    return false;
  }
}

export function initHttpInterceptor(): void {
  if (interceptor) {
    console.log("HTTP Interceptor already initialized")
    interceptor.dispose();
    interceptor = null;
    return;
  }
  console.log("HTTP Interceptor: Initializing HTTP interceptors");
  interceptor = new BatchInterceptor({
    name: "gobi-http-interceptor",
    interceptors: [new ClientRequestInterceptor(), new FetchInterceptor(), new XMLHttpRequestInterceptor()],
  });

  interceptor.apply();

  console.log("HTTP Interceptor: Intercepted applied successfully 1st time");

  interceptor.on("request", ({ request }) => {
  const url =
    typeof request.url === "string" ? request.url : String(request.url);
  if (!isAllowed(url)) {
    console.log("HTTP Interceptor: blocked egress request %s", url);
    return { ERROR: "url is blocked" };
  }
  });

}

export function disposeHttpInterceptor(): void {
  if (interceptor) {
    interceptor.dispose();
    interceptor = null;
    console.log("HTTP Interceptor disposed")
  }
};
