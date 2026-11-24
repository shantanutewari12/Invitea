/**
 * The only thing the app knows about an LLM. Providers return RAW TEXT; the pipeline validates
 * it with Zod, so a provider can never inject code, HTML or URLs into an invitation.
 */
export interface LLMRequest {
  system: string;
  user: string;
  /** JSON schema of the object the model must return. */
  jsonSchema: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generateJson(request: LLMRequest): Promise<string>;
}
