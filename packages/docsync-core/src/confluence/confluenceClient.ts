export interface ConfluenceClient {
  fetchPage(pageId: string): Promise<string>;
}

export interface ConfluenceClientOptions {
  baseUrl: string;
  email: string;
  apiToken: string;
}

/**
 * Thin REST client over the Confluence API v2 "get page" endpoint (`body-format=storage`), which
 * returns a JSON shape compatible with `ConfluenceAdapter.parse` (`id`, `title`,
 * `body.storage.value`). Reading is unauthenticated-by-token-free here; actually publishing back
 * to Confluence is intentionally a separate, explicit opt-in operation (architecture.md §7) and is
 * not implemented by this read-only client.
 */
export class RestConfluenceClient implements ConfluenceClient {
  constructor(private readonly options: ConfluenceClientOptions) {}

  async fetchPage(pageId: string): Promise<string> {
    const auth = Buffer.from(`${this.options.email}:${this.options.apiToken}`).toString("base64");
    const response = await fetch(`${this.options.baseUrl}/wiki/api/v2/pages/${pageId}?body-format=storage`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Confluence page fetch failed: ${response.status} ${await response.text()}`);
    }
    return response.text();
  }
}

/** Resolves a ConfluenceClient from environment variables, or undefined if not configured. */
export function resolveConfluenceClientFromEnv(env: NodeJS.ProcessEnv = process.env): ConfluenceClient | undefined {
  const { CONFLUENCE_BASE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN } = env;
  if (!CONFLUENCE_BASE_URL || !CONFLUENCE_EMAIL || !CONFLUENCE_API_TOKEN) return undefined;
  return new RestConfluenceClient({
    baseUrl: CONFLUENCE_BASE_URL,
    email: CONFLUENCE_EMAIL,
    apiToken: CONFLUENCE_API_TOKEN
  });
}
