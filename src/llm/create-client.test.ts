import { describe, expect, it } from "vitest";
import { createLlmClient } from "./create-client.js";

describe("createLlmClient", () => {
  it("defaults to Ollama with no environment configured, so it works with no API key", () => {
    // Construction never throws for lack of credentials when the default (Ollama) provider is used —
    // that's the whole point of the provider abstraction.
    expect(() => createLlmClient({ env: {} })).not.toThrow();
  });

  it("throws a clear error for the Anthropic provider with no API key, rather than failing inside a network call", () => {
    expect(() => createLlmClient({ env: { LLM_PROVIDER: "anthropic" } })).toThrow(
      /ANTHROPIC_API_KEY/
    );
  });

  it("selects Anthropic when both the provider and an API key are configured", () => {
    expect(() =>
      createLlmClient({ env: { LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "test-key" } })
    ).not.toThrow();
  });
});
