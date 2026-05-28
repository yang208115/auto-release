# GitHub Release Writer (auto-release)

使用 AI 从 GitHub 提交历史中自动生成专业的发布说明（Release Notes）。本项目由纯静态前端（HTML + TailwindCSS）与强大的 Cloudflare Workers 后端流式 API 构建而成。

## 🌟 核心特性

- 🤖 **多模型支持**：内置支持 OpenAI (如 `gpt-4o-mini`) 与 Anthropic (如 `claude-3-5-sonnet-20241022`) 模型。
- ⚡ **流式生成体验**：通过 Cloudflare Workers 提供 Server-Sent Events (SSE) 流式返回，像聊天机器人一样实时在网页端渲染 Markdown 结果。
- ⚙️ **高度可配置**：支持自定义 AI Base URL（代理地址）、自定义请求 Model Name，以及提供 GitHub Token 以应对高频 API 速率限制。
- 🎨 **现代化 UI**：界面完全采用 TailwindCSS 设计，配置面板可原生折叠，适配深色/浅色模式，保持清晰、极简且符合直觉的交互体验。

## 🛠️ 技术栈

- **前端**: 原生 HTML5, Vanilla JavaScript, TailwindCSS, Marked.js (Markdown 解析)。
- **后端**: Cloudflare Workers, TypeScript。
- **构建工具**: Vite / Wrangler 等底层支持。

## 🚀 本地开发与部署

确保本地已安装 [Node.js](https://nodejs.org/) 以及包管理器（如 `npm` 或 `pnpm`）。

### 1. 安装依赖

```bash
npm install
# 或者使用 pnpm
pnpm install
```

### 2. 本地开发运行

启动本地的 Wrangler 开发服务器：

```bash
npm run dev
# 或
npm start
```

启动后，访问终端输出的本地端口地址（通常是 `http://localhost:8787`），即可在本地进行开发与调试。

### 3. 类型生成

若修改了 `wrangler.jsonc` 中的环境变量或绑定内容，需更新全类型：

```bash
npm run cf-typegen
```

### 4. 部署到 Cloudflare

使用 Wrangler 一键部署至您的 Cloudflare 账号下：

```bash
npm run deploy
```

## 📖 使用指南

1. 进入网站后，在顶部的 **“配置选项”** 面板中，选择您的 AI 提供商（OpenAI 或 Anthropic）。
2. 输入相应的 API Key，按需填入 GitHub Token 与高级选项（如 Base URL 和具体的模型）。
3. 点击 **保存设置**。
4. 在下方输入目标 GitHub **仓库地址**（例如：`yang208115/auto-release`）与对应的 **Git 标签或分支号**（例如：`main` 或 `v1.0.0`）。
5. 点击 **生成发布说明** 按钮。
6. 实时在底部的预览版块查看生成的 Markdown 文档流，满意后可直接点击标题栏的 **复制** 按钮。

## 📝 贡献与许可

该项目为内部提效工具。欢迎随时提交 Issue 或发起 PR 来增强应用功能。
