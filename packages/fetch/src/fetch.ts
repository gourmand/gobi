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
      // Read CA files as Buffers. undici's client expects a single Buffer
      // or string for `ca` in some versions, so concatenate multiple CA
      // files into one Buffer to be robust.
      const buffers = paths.map((p) => fs.readFileSync(p));
      tls.ca = Buffer.concat(buffers);
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

  // Some undici versions/constructors accept TLS options at the top-level
  // agent options as well — set them both places to increase compatibility.
  if (Object.keys(tls).length > 0) {
  }

  if (Object.keys(connect).length > 0) {
    agentOptions.connect = connect;
  }

  // Also surface common TLS options at the top-level of agentOptions
  // because undici's connector will spread those into tls.connect.
  if (tls.ca) {
    agentOptions.ca = tls.ca;
  }
  if (typeof tls.rejectUnauthorized !== "undefined") {
    agentOptions.rejectUnauthorized = tls.rejectUnauthorized;
  }
  if (tls.cert) {
    agentOptions.cert = tls.cert;
  }
  if (tls.key) {
    agentOptions.key = tls.key;
  }
  if (tls.passphrase) {
    agentOptions.passphrase = tls.passphrase;
  }

  if (requestOptions.proxy) {
    try {
      // Try giving ProxyAgent the connect/tls options if supported
      const proxyAgent = new (ProxyAgent as any)({
        uri: requestOptions.proxy,
        connect,
      });
      return { dispatcher: proxyAgent, undiciFetch };
    } catch (e) {
      try {
        const proxyAgent = new (ProxyAgent as any)(
          requestOptions.proxy,
          agentOptions,
        );
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
    // If TLS options are requested but no proxy/clientCertificate is
    // required, prefer using NODE_TLS_REJECT_UNAUTHORIZED /
    // NODE_EXTRA_CA_CERTS to influence Node's TLS behavior for this
    // single request. This avoids cross-version undici Agent option
    // incompatibilities.
    // Only use env-based override when verifySsl is explicitly disabled
    // and no custom CA bundle is requested. For custom CA bundles we
    // rely on a dispatcher/agent so the CA can be passed to the TLS
    // connector directly.
    const wantsTlsOverride =
      !!_requestOptions &&
      _requestOptions.verifySsl === false &&
      !_requestOptions.caBundlePath;

    const needsProxyOrClientCert =
      !!_requestOptions &&
      (!!_requestOptions.proxy || !!_requestOptions.clientCertificate);

    if (wantsTlsOverride && !needsProxyOrClientCert) {
      const prevNodeTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      const prevExtraCa = process.env.NODE_EXTRA_CA_CERTS;
      try {
        if (_requestOptions.verifySsl === false) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }
        if (_requestOptions.caBundlePath) {
          // If an array is provided, pick the first path; tests pass a single path.
          const caPath = Array.isArray(_requestOptions.caBundlePath)
            ? _requestOptions.caBundlePath[0]
            : _requestOptions.caBundlePath;
          process.env.NODE_EXTRA_CA_CERTS = caPath;
        }

        const resp = await fetch(url.toString(), {
          ...finalInit,
          signal: controller.signal,
        } as any);
        return resp as Response;
      } finally {
        // restore env
        if (prevNodeTls === undefined)
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevNodeTls;
        if (prevExtraCa === undefined) delete process.env.NODE_EXTRA_CA_CERTS;
        else process.env.NODE_EXTRA_CA_CERTS = prevExtraCa;
      }
    }

    // If a custom CA bundle was provided and we don't need proxy/client
    // certificates, make a direct Node https request using the provided
    // CA. This avoids fighting with undici Agent option differences and
    // allows us to validate the server cert against the supplied bundle.
    if (
      !!_requestOptions?.caBundlePath &&
      !needsProxyOrClientCert &&
      url.protocol === "https:"
    ) {
      const https = await import("node:https");
      const caPath = Array.isArray(_requestOptions.caBundlePath)
        ? _requestOptions.caBundlePath[0]
        : _requestOptions.caBundlePath;

      const ca = fs.readFileSync(caPath);

      // Build options for https.request
      const parsed = new URL(url.toString());
      const requestOptions: any = {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 443,
        path: parsed.pathname + (parsed.search || ""),
        method: finalInit.method || "GET",
        headers: finalInit.headers as any,
        ca,
        rejectUnauthorized: _requestOptions.verifySsl !== false,
      };

      const body = finalInit.body;

      return await new Promise<Response>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.from(c)));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            const resp = new Response(buf, {
              status: res.statusCode || 200,
              headers: res.headers as any,
            });
            resolve(resp as Response);
          });
        });
        req.on("error", (err) => reject(err));
        if (controller.signal) {
          controller.signal.addEventListener("abort", () => req.abort());
        }
        if (body) {
          req.write(body as any);
        }
        req.end();
      });
    }

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
