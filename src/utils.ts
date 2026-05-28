import { ClientCredentials } from './types.js';

export class APIError extends Error {
    public status: number;
    constructor(message: string, status: number = 500) {
        super(message);
        this.status = status;
        this.name = 'APIError';
    }
}

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-github-token, x-openai-key, x-anthropic-key, x-ai-base-url, x-ai-model',
    'Access-Control-Expose-Headers': 'X-Commits-Analyzed',
    'Access-Control-Max-Age': '86400',
};

export function handleOptions(request: Request): Response {
    if (
        request.headers.get('Origin') !== null &&
        request.headers.get('Access-Control-Request-Method') !== null &&
        request.headers.get('Access-Control-Request-Headers') !== null
    ) {
        // Handle CORS preflight requests
        return new Response(null, {
            headers: corsHeaders,
        });
    } else {
        // Handle standard OPTIONS request
        return new Response(null, {
            headers: {
                Allow: 'GET, HEAD, POST, OPTIONS',
            },
        });
    }
}

export function extractCredentials(request: Request): ClientCredentials {
    const getHeader = (name: string) => {
        const val = request.headers.get(name);
        return (val && val.trim() !== '' && val !== 'null' && val !== 'undefined') ? val.trim() : undefined;
    };

    return {
        githubToken: getHeader('x-github-token'),
        openaiKey: getHeader('x-openai-key'),
        anthropicKey: getHeader('x-anthropic-key'),
        aiBaseUrl: getHeader('x-ai-base-url'),
        aiModel: getHeader('x-ai-model'),
    };
}

export function jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json;charset=UTF-8',
        },
    });
}

export function errorResponse(error: unknown): Response {
    let status = 500;
    let message = 'Internal Server Error';

    if (error instanceof APIError) {
        status = error.status;
        message = error.message;
    } else if (error instanceof Error) {
        message = error.message;
    }

    return jsonResponse({ error: message }, status);
}
