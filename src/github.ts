import { GitHubCommitItem, ClientCredentials } from './types.js';
import { APIError } from './utils.js';

/**
 * Internal helper for GitHub API requests with caching and auth
 */
async function fetchGitHub(
    url: string,
    credentials: ClientCredentials
): Promise<Response> {
    const cache = caches.default;
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Worker-AutoRelease',
    };

    if (credentials.githubToken) {
        headers['Authorization'] = `token ${credentials.githubToken}`;
    }

    const cacheRequest = new Request(url, {
        method: 'GET',
        headers
    });

    let response = await cache.match(cacheRequest);

    if (!response) {
        response = await fetch(cacheRequest);

        if (response.status === 200) {
            const responseToCache = new Response(response.clone().body, response);
            responseToCache.headers.append('Cache-Control', 's-maxage=1800');
            try { await cache.put(cacheRequest, responseToCache); } catch (e) { }
        }
    }

    if (!response.ok) {
        let errorMsg = `GitHub API responded with ${response.status} ${response.statusText}`;
        try {
            const data = await response.json() as Record<string, any>;
            errorMsg = data.message || errorMsg;
        } catch (e) { }

        let statusCode = response.status;
        if (statusCode === 401) {
            errorMsg = 'GitHub 鉴权失败：Token 无效或已过期。请在配置选项中检查您的 GitHub Token。';
        } else if (statusCode === 403 && errorMsg.toLowerCase().includes('rate limit')) {
            errorMsg = '获取 GitHub 数据失败：API 访问额度已耗尽。请提供 GitHub Token 以提高额度。';
        } else if (statusCode === 404) {
            statusCode = 400;
            errorMsg = '获取 GitHub 数据失败：未找到目标仓库或版本。';
        } else {
            errorMsg = `GitHub API 错误: ${errorMsg}`;
        }

        throw new APIError(errorMsg, statusCode);
    }

    return response;
}

/**
 * Fetch commits until a specific tag or a max number, utilizing caching
 */
/**
 * Fetch all tags for a repository
 */
export async function getTags(
    owner: string,
    repo: string,
    credentials: ClientCredentials
): Promise<{ name: string }[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`;
    const response = await fetchGitHub(url, credentials);
    return await response.json() as { name: string }[];
}

/**
 * Fetch commits between tags or for a single tag
 */
export async function getCommits(
    owner: string,
    repo: string,
    tag: string,
    credentials: ClientCredentials
): Promise<GitHubCommitItem[]> {
    // 1. Fetch tags to find the previous one
    let range = tag;
    try {
        const tags = await getTags(owner, repo, credentials);
        const currentIndex = tags.findIndex(t => t.name === tag);

        if (currentIndex !== -1 && currentIndex < tags.length - 1) {
            const previousTag = tags[currentIndex + 1].name;
            range = `${previousTag}...${tag}`;
        }
    } catch (e) {
        console.warn('Failed to fetch tags for range detection, falling back to single tag:', e);
    }

    console.log('Fetching commits for range:', range);
    const url = `https://api.github.com/repos/${owner}/${repo}/compare/${range}`;
    const response = await fetchGitHub(url, credentials);
    const data = await response.json() as { commits: GitHubCommitItem[] };

    if (!data || !Array.isArray(data.commits)) {
        throw new APIError('Invalid response format from GitHub API: expected commits array', 500);
    }

    return data.commits;
}
