import { Env, GenerateReleaseRequest } from './types.js';
import { handleOptions, extractCredentials, jsonResponse, errorResponse, APIError, corsHeaders } from './utils.js';
import { getCommits } from './github.js';
import { generateReleaseNotesStream } from './ai-generator.js';

async function handleGenerateRelease(request: Request, _env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		throw new APIError('Method Not Allowed', 405);
	}

	// Extract body and validate
	let payload: GenerateReleaseRequest;
	try {
		payload = await request.json<GenerateReleaseRequest>();
	} catch (e) {
		throw new APIError('Invalid JSON payload', 400);
	}

	const { owner, repo, tag, aiProvider = 'openai' } = payload;

	if (!owner || !repo || !tag) {
		throw new APIError('Missing required fields: owner, repo, tag', 400);
	}

	if (aiProvider !== 'openai' && aiProvider !== 'anthropic') {
		throw new APIError('Invalid aiProvider. Must be "openai" or "anthropic".', 400);
	}

	// Extract credentials from request headers
	const credentials = extractCredentials(request);

	// 1. Fetch commits from GitHub
	const commits = await getCommits(owner, repo, tag, credentials);

	if (commits.length === 0) {
		throw new APIError(`No commits found for tag: ${tag}`, 404);
	}

	// 2. Get AI Generator Stream
	const stream = await generateReleaseNotesStream(commits, tag, aiProvider, credentials);

	// 3. Assemble response
	return new Response(stream, {
		status: 200,
		headers: {
			...corsHeaders,
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive',
			'X-Commits-Analyzed': commits.length.toString(),
		}
	});
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);

			// Handle CORS Preflight
			if (request.method === 'OPTIONS') {
				return handleOptions(request);
			}

			// Router
			if (url.pathname.replace(/\/$/, '') === '/generate-release') {
				return await handleGenerateRelease(request, env);
			}

			// 404 Fallback for unhandled paths (since static assets are served by Cloudflare automatically via assets.directory)
			return jsonResponse({ error: 'Not Found' }, 404);
		} catch (error) {
			return errorResponse(error);
		}
	}
} satisfies ExportedHandler<Env>;
