import { GitHubCommitItem, ClientCredentials } from './types.js';
import { APIError } from './utils.js';

/**
 * Fetch commits until a specific tag or a max number, utilizing caching
 */
export async function getCommits(
    owner: string,
    repo: string,
    tag: string,
    credentials: ClientCredentials
): Promise<GitHubCommitItem[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${tag}&per_page=50`;

    // Use Cloudflare standard cache based on Request URL
    const cache = caches.default;
    const cacheRequest = new Request(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-Worker-AutoRelease',
            ...(credentials.githubToken ? { 'Authorization': `Bearer ${credentials.githubToken}` } : {})
        }
    });

    // Check cache first (Cache API works primarily for GETs with 200/Cache-Control statuses)
    let response = await cache.match(cacheRequest);

    if (!response) {
        // Determine whether to fetch upstream
        response = await fetch(cacheRequest);

        // Attempt cache insertion for successful GET fetches
        if (response.status === 200) {
            // Put cloned response to cache, expires in 30 minutes to save GH API quota
            const responseToCache = new Response(response.clone().body, response);
            responseToCache.headers.append('Cache-Control', 's-maxage=1800');
            // Intentionally ignore potential failure if local worker doesn't support cache API seamlessly
            try {
                await cache.put(cacheRequest, responseToCache);
            } catch (e) {
                // ignore cache errors
            }
        }
    }

    if (!response.ok) {
        let errorMsg = `GitHub API responded with ${response.status} ${response.statusText}`;
        try {
            const data = await response.json() as Record<string, string>;
            errorMsg = data.message || errorMsg;
        } catch (e) {
            // Body not parsable
        }

        let statusCode = response.status;
        if (statusCode === 404) {
            statusCode = 400; // Map 404 to 400 to distinguish from standard route 404s
            errorMsg += ' (Please check if the repo exists and is accessible)';
        }

        throw new APIError(`Failed to fetch commits from GitHub: ${errorMsg}`, statusCode);
    }

    const commits = await response.json() as GitHubCommitItem[];

    if (!Array.isArray(commits)) {
        throw new APIError('Invalid response format from GitHub API', 500);
    }

    return commits;
}
