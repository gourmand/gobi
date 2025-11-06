import { RequestOptions } from "@gourmanddev/config-types";
import fs from "fs";

// Node-24 native fetch wrapper that uses undici when advanced TLS/proxy
// options are required. We lazy-import undici to avoid adding load-time
// cost for callers that only need the simple path.

function normalizeUrl(url_: URL | string) {
  const url = typeof url_ === "string" ? new URL(url_) : url_;
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  return url;
}

function mergeHeaders(init?: RequestInit, requestOptions?: RequestOptions) {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const headersSource = init.headers as any;
    if (headersSource && typeof headersSource.forEach === "function") {
      headersSource.forEach((value: string, key: string) => {
        headers[key] = value;
      });
    } else if (Array.isArray(headersSource)) {
      for (const [key, value] of headersSource) {
        headers[key] = value as string;
      }
    } else if (headersSource && typeof headersSource === "object") {
      for (const [key, value] of Object.entries(headersSource)) {
        headers[key] = value as string;
      }
    }
  }
  if (requestOptions?.headers) {
    for (const [key, value] of Object.entries(requestOptions.headers)) {
      headers[String(key)] = String(value as any);
    }
  }
  return headers;
}

async function createDispatcherIfNeeded(
  requestOptions?: RequestOptions,
): Promise<any | undefined> {
  if (!requestOptions) return undefined;

  const needsDispatcher =
    !!requestOptions.proxy ||
    !!requestOptions.caBundlePath ||
    !!requestOptions.clientCertificate ||
    requestOptions.verifySsl === false;

  if (!needsDispatcher) return undefined;

  const undici = await import("undici");
  const { Agent, ProxyAgent, fetch: undiciFetch } = undici as any;

  const agentOptions: any = {};
  const connect: any = {};
  const tls: any = {};

  if (requestOptions.verifySsl === false) {
    tls.rejectUnauthorized = false;
  }

  if (requestOptions.caBundlePath) {
    const paths = Array.isArray(requestOptions.caBundlePath)
      ? requestOptions.caBundlePath
      : [requestOptions.caBundlePath];
    try {
      tls.ca = paths.map((p) => fs.readFileSync(p).toString());
    } catch (e) {
      // ignore read errors and let the request fail later
    }
  }

  if (requestOptions.clientCertificate) {
    try {
      tls.cert = requestOptions.clientCertificate.cert;
      tls.key = requestOptions.clientCertificate.key;
      if (requestOptions.clientCertificate.passphrase) {
        tls.passphrase = requestOptions.clientCertificate.passphrase;
      }
    } catch (e) {
      // ignore
    }
  }

  if (Object.keys(tls).length > 0) {
    connect.tls = tls;
  }

  if (Object.keys(connect).length > 0) {
    agentOptions.connect = connect;
  }

  if (requestOptions.proxy) {
    try {
      const proxyAgent = new (ProxyAgent as any)({ uri: requestOptions.proxy });
      return { dispatcher: proxyAgent, undiciFetch };
    } catch (e) {
      try {
        const proxyAgent = new (ProxyAgent as any)(requestOptions.proxy);
        return { dispatcher: proxyAgent, undiciFetch };
      } catch (e2) {
        // fall through
      }
    }
  }

  try {
    const agent = new (Agent as any)(agentOptions);
    return { dispatcher: agent, undiciFetch };
  } catch (e) {
    return undefined;
  }
}

export async function fetchwithRequestOptions(
  url_: URL | string,
  init?: RequestInit,
  _requestOptions?: RequestOptions,
): Promise<Response> {
  const url = normalizeUrl(url_);

  const headers = mergeHeaders(init, _requestOptions);

  const finalBody = (() => {
    try {
      if (
        _requestOptions?.extraBodyProperties &&
        typeof init?.body === "string"
      ) {
        const parsedBody = JSON.parse(init!.body as string);
        return JSON.stringify({
          ...parsedBody,
          ..._requestOptions.extraBodyProperties,
        });
      }
    } catch (e) {
      // ignore parse errors and fall back to original body
    }
    return init?.body;
  })();

  const finalInit: RequestInit = {
    ...init,
    body: finalBody ?? init?.body,
    headers,
  };

  let timeoutId: NodeJS.Timeout | undefined;
  const controller = new AbortController();
  if (finalInit.signal) {
    const callerSignal = finalInit.signal as AbortSignal;
    callerSignal.addEventListener("abort", () => controller.abort());
  }

  if (_requestOptions?.timeout && _requestOptions.timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(), _requestOptions.timeout);
  }

  const dispatcherInfo = await createDispatcherIfNeeded(_requestOptions);

  try {
    if (dispatcherInfo) {
      const { dispatcher, undiciFetch } = dispatcherInfo as any;
      const resp = await undiciFetch(url.toString(), {
        ...finalInit,
        signal: controller.signal,
        dispatcher,
      } as any);
      return resp as unknown as Response;
    }

    const resp = await fetch(url.toString(), {
      ...finalInit,
      signal: controller.signal,
    } as any);
    return resp as Response;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error && error.name === "AbortError") {
      return new Response(null, {
        status: 499,
        statusText: "Client Closed Request",
      });
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
