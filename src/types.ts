// Env context for Workers
export interface Env {
    // We can add KV Namespaces or Durable Objects here later if needed
}

// Request matching body
export interface GenerateReleaseRequest {
    owner: string;
    repo: string;
    tag: string;
    aiProvider?: 'openai' | 'anthropic';
}

// Response
export interface GenerateReleaseResponse {
    tag: string;
    releaseNotes: string;
    commitsAnalyzed: number;
    generatedAt: string;
}

// Client Credentials injected via headers
export interface ClientCredentials {
    githubToken?: string;
    openaiKey?: string;
    anthropicKey?: string;
    aiBaseUrl?: string;
    aiModel?: string;
}

// GitHub API Types
export interface GitHubCommitAuthor {
    name: string;
    email: string;
    date: string;
}

export interface GitHubCommitDetail {
    author: GitHubCommitAuthor;
    message: string;
}

export interface GitHubCommitItem {
    sha: string;
    commit: GitHubCommitDetail;
    html_url: string;
}

// OpenAI Request Types
export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenAIRequestPayload {
    model: string;
    messages: OpenAIMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface OpenAIResponseChoice {
    message: OpenAIMessage;
}

export interface OpenAIResponsePayload {
    choices: OpenAIResponseChoice[];
}

// Anthropic Request Types
export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AnthropicRequestPayload {
    model: string;
    system: string;
    messages: AnthropicMessage[];
    max_tokens: number;
    temperature?: number;
    stream?: boolean;
}

export interface AnthropicResponsePayload {
    content: Array<{ text: string; type: string }>;
}
