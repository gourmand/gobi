// Minimal manual mock for `node-fetch` used in unit tests.
// Keeps the interface small but compatible with typical usage in tests.
export default function fetch(url: string, init?: any): Promise<Response> {
  return Promise.resolve(new Response(''));
}

export class Response {
  ok = true;
  status = 200;
  headers = new Map<string, string>();

  constructor(private bodyText = '') {}

  async text(): Promise<string> {
    return this.bodyText;
  }

  async json(): Promise<any> {
    try {
      return JSON.parse(this.bodyText || '{}');
    } catch {
      return null;
    }
  }

  clone(): Response {
    return new Response(this.bodyText);
  }
}

// Minimal Request / Headers classes to satisfy imports if used
export class Request {
  constructor(public url: string, public init?: any) {}
}

export class Headers {
  private map = new Map<string, string>();
  get(k: string) {
    return this.map.get(k) ?? null;
  }
  set(k: string, v: string) {
    this.map.set(k, v);
  }
}

// Keep named export compatibility
