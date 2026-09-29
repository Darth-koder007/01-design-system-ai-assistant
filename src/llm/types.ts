export interface GenerateRequest {
  /** The user-facing instruction. Kept provider-neutral — no assumptions about message roles beyond system/user. */
  prompt: string;
  system?: string;
}

export interface GenerateResult {
  text: string;
  provider: string;
  model: string;
}

export interface LlmClient {
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export type LlmProvider = "ollama" | "anthropic";
