import {
    ClientCredentials,
    GitHubCommitItem,
    OpenAIRequestPayload,
    OpenAIResponsePayload,
    AnthropicRequestPayload,
    AnthropicResponsePayload
} from './types.js';
import { APIError } from './utils.js';

function buildPrompt(commits: GitHubCommitItem[], tag: string): string {
    const commitListText = commits.map(c =>
        `- [${c.sha.substring(0, 7)}] ${c.commit.message.split('\n')[0]} (by ${c.commit.author.name})`
    ).join('\n');

    return `
你是一个专业的开源项目 Release Notes 撰写助手。
    我们要针对版本 \`${tag}\` 生成一份面向用户的、高质量的 Release Notes。
以下是提取到的 Git Commits：

<commits>
${commitListText}
</commits>

## 输出格式与处理要求:
1. **纯 Markdown 格式**：请直接输出 Markdown 文本，绝不要在最外层使用 \`\`\`markdown 代码块包裹。
2. **分类整理**：务必将变更归类到以下类别中（如果某类没有属于它的 commit，则忽略该类）：
   - 🚀 Features (新特性)
   - 🐛 Bug Fixes (问题修复)
   - 🔧 Improvements (优化与改进)
   - 📝 Documentation (文档更新)
   - ⚠️ Breaking Changes (可能破坏向后兼容的重大变更)
3. **语言风格**：
   - 将生硬、简短的前后端 commit 术语润色为**易于用户理解**的功能描述，不要显得太像机器翻译。
   - 保持语言简练，避免啰嗦。合并相似或相关的 commit 描述。
4. **贡献者致谢**：
   - 在每条记录的末尾，如果 commit 中包含不同的作者姓名，请加上对贡献者的感谢声明（例如：\` - 支持了国际化多语言 (@用户名)\`）。
   - 如果同一个类别下有太多同一人的贡献，可以统一在该类别合并感谢。
  `.trim();
}

function parseOpenAIStream(responseBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');

    return new ReadableStream({
        async start(controller) {
            const reader = responseBody.getReader();
            let incompleteData = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkStr = decoder.decode(value, { stream: true });
                    const lines = (incompleteData + chunkStr).split('\n');
                    incompleteData = lines.pop() || ''; // Keep the last incomplete line

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                        if (trimmedLine.startsWith('data:')) {
                            const dataStr = trimmedLine.slice(5).trim();

                            // If it smells like JSON, try extracting it securely
                            if (dataStr.startsWith('{') || dataStr.startsWith('[')) {
                                try {
                                    const parsed = JSON.parse(dataStr);
                                    const text = parsed.choices?.[0]?.delta?.content || '';
                                    if (text) {
                                        controller.enqueue(encoder.encode(text));
                                    }
                                } catch (e) {
                                    // If JSON parsing fails halfway, skip silently and wait for next chunk, or enqueue raw
                                    // Generally partial JSON indicates broken stream from proxy
                                }
                            } else if (dataStr.length > 0) {
                                // Raw stream chunks (used by some generic OpenAI-compatible proxies that just mirror raw text)
                                controller.enqueue(encoder.encode(dataStr));
                            }
                        }
                    }
                }

                // Process remaining buffered text if any
                if (incompleteData) {
                    const trimmedLine = incompleteData.trim();
                    if (trimmedLine.startsWith('data:')) {
                        const dataStr = trimmedLine.slice(5).trim();
                        if (dataStr && dataStr !== '[DONE]') {
                            try {
                                const parsed = JSON.parse(dataStr);
                                const text = parsed.choices?.[0]?.delta?.content || '';
                                if (text) controller.enqueue(encoder.encode(text));
                            } catch (e) {
                                controller.enqueue(encoder.encode(dataStr));
                            }
                        }
                    }
                }
            } catch (err) {
                controller.error(err);
            } finally {
                controller.close();
            }
        }
    });
}

function parseAnthropicStream(responseBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');

    return new ReadableStream({
        async start(controller) {
            const reader = responseBody.getReader();
            let incompleteData = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkStr = decoder.decode(value, { stream: true });
                    const lines = (incompleteData + chunkStr).split('\n');
                    incompleteData = lines.pop() || '';

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;

                        if (trimmedLine.startsWith('data:')) {
                            const dataStr = trimmedLine.slice(5).trim();
                            if (dataStr === '[DONE]') continue;

                            if (dataStr.startsWith('{') || dataStr.startsWith('[')) {
                                try {
                                    const parsed = JSON.parse(dataStr);
                                    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                                        const text = parsed.delta.text || '';
                                        if (text) {
                                            controller.enqueue(encoder.encode(text));
                                        }
                                    }
                                } catch (e) {
                                }
                            } else if (dataStr.length > 0) {
                                controller.enqueue(encoder.encode(dataStr));
                            }
                        }
                    }
                }

                if (incompleteData) {
                    const trimmedLine = incompleteData.trim();
                    if (trimmedLine.startsWith('data:')) {
                        const dataStr = trimmedLine.slice(5).trim();
                        if (dataStr && dataStr !== '[DONE]') {
                            try {
                                const parsed = JSON.parse(dataStr);
                                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                                    const text = parsed.delta.text || '';
                                    if (text) controller.enqueue(encoder.encode(text));
                                }
                            } catch (e) {
                                controller.enqueue(encoder.encode(dataStr));
                            }
                        }
                    }
                }
            } catch (err) {
                controller.error(err);
            } finally {
                controller.close();
            }
        }
    });
}

async function generateStreamWithOpenAI(prompt: string, apiKey: string, baseUrl?: string, customModel?: string): Promise<ReadableStream<Uint8Array>> {
    const payload: OpenAIRequestPayload = {
        model: customModel || 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'You are an AI that writes excellent GitHub Markdown release notes.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.7,
        stream: true
    };

    const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new APIError(`OpenAI API failed: ${response.status} ${errText}`, response.status);
    }

    if (!response.body) {
        throw new APIError('Empty response body from OpenAI', 500);
    }

    return parseOpenAIStream(response.body);
}

async function generateStreamWithAnthropic(prompt: string, apiKey: string, baseUrl?: string, customModel?: string): Promise<ReadableStream<Uint8Array>> {
    const payload: AnthropicRequestPayload = {
        model: customModel || 'claude-3-5-sonnet-20241022',
        system: 'You are an AI that writes excellent GitHub Markdown release notes.',
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        stream: true
    };

    const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/messages` : 'https://api.anthropic.com/v1/messages';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new APIError(`Anthropic API failed: ${response.status} ${errText}`, response.status);
    }

    if (!response.body) {
        throw new APIError('Empty response body from Anthropic', 500);
    }

    return parseAnthropicStream(response.body);
}

export async function generateReleaseNotesStream(
    commits: GitHubCommitItem[],
    tag: string,
    provider: 'openai' | 'anthropic',
    credentials: ClientCredentials
): Promise<ReadableStream<Uint8Array>> {
    const prompt = buildPrompt(commits, tag);

    if (provider === 'anthropic') {
        if (!credentials.anthropicKey) {
            throw new APIError('Anthropic API key is missing', 401);
        }
        return await generateStreamWithAnthropic(prompt, credentials.anthropicKey, credentials.aiBaseUrl, credentials.aiModel);
    } else {
        if (!credentials.openaiKey) {
            throw new APIError('OpenAI API key is missing', 401);
        }
        return await generateStreamWithOpenAI(prompt, credentials.openaiKey, credentials.aiBaseUrl, credentials.aiModel);
    }
}
