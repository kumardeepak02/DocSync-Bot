import { RestConfluenceClient, resolveConfluenceClientFromEnv } from "../src/confluence/confluenceClient";

describe("RestConfluenceClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("fetches a page using Basic auth and returns the raw JSON text", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '{"id":"123"}' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new RestConfluenceClient({ baseUrl: "https://example.atlassian.net", email: "a@b.com", apiToken: "tok" });
    const result = await client.fetchPage("123");

    expect(result).toBe('{"id":"123"}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.atlassian.net/wiki/api/v2/pages/123?body-format=storage");
    expect(init.headers.Authorization).toMatch(/^Basic /);
  });

  it("throws a descriptive error when the response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "not found" }) as unknown as typeof fetch;
    const client = new RestConfluenceClient({ baseUrl: "https://example.atlassian.net", email: "a@b.com", apiToken: "tok" });
    await expect(client.fetchPage("999")).rejects.toThrow(/404/);
  });
});

describe("resolveConfluenceClientFromEnv", () => {
  it("returns undefined when Confluence env vars are not fully configured", () => {
    expect(resolveConfluenceClientFromEnv({})).toBeUndefined();
    expect(resolveConfluenceClientFromEnv({ CONFLUENCE_BASE_URL: "https://x" } as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("returns a RestConfluenceClient when all env vars are present", () => {
    const client = resolveConfluenceClientFromEnv({
      CONFLUENCE_BASE_URL: "https://example.atlassian.net",
      CONFLUENCE_EMAIL: "a@b.com",
      CONFLUENCE_API_TOKEN: "tok"
    } as NodeJS.ProcessEnv);
    expect(client).toBeInstanceOf(RestConfluenceClient);
  });
});
