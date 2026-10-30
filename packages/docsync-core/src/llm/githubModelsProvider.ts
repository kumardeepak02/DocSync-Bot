import { LLMProvider } from "../types";

export interface GitHubModelsProviderOptions {
  token: string;
  endpoint?: string;
  model?: string;
  maxRetries?: number;
}

const DEFAULT_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Real LLM provider backed by the GitHub Models inference endpoint (OpenAI-compatible chat
 * completions API). Retries with exponential backoff on 429/5xx responses, matching the
 * architecture's "basic retry/backoff" risk mitigation.
 */
export class GitHubModelsProvider implements LLMProvider {
  name = "github-models";

  private readonly token: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly maxRetries: number;

  constructor(options: GitHubModelsProviderOptions) {
    this.token = options.token;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxRetries = options.maxRetries ?? 3;
  }

  async generate(prompt: string): Promise<string> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "system",
                content:
                  "You update software documentation to match code changes. Reply with only the " +
                  "corrected documentation content, no commentary."
              },
              { role: "user", content: prompt }
            ]
          })
        });

        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Retryable status ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(`GitHub Models request failed: ${response.status} ${await response.text()}`);
        }

        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content?.trim() ?? "";
      } catch (error) {
        lastError = error;
        attempt++;
        if (attempt > this.maxRetries) break;
        await sleep(2 ** attempt * 250);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("GitHub Models request failed");
  }
}

/**
 * Resolves the configured LLMProvider from environment variables, or `undefined` if no API key is
 * present — the caller (`SuggestionEngine`) treats `undefined` as "fall back to detection-only
 * mode" (NFR-4, design review Finding 5).
 */
export function resolveLLMProviderFromEnv(env: NodeJS.ProcessEnv = process.env): LLMProvider | undefined {
  const token = env.GITHUB_MODELS_TOKEN;
  if (!token) return undefined;
  return new GitHubModelsProvider({
    token,
    endpoint: env.GITHUB_MODELS_ENDPOINT,
    model: env.GITHUB_MODELS_MODEL
  });
}
