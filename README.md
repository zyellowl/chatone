# ChatOne on LibreChat

ChatOne is an open-source personal chat experience built on LibreChat `v0.8.7`. GPT models use the current
macOS user's ChatGPT/Codex OAuth subscription through a loopback-only compatibility bridge. ZenMux
remains configured for optional non-GPT providers; all credentials remain server-side.

ChatOne is an independent community project. It is not affiliated with or endorsed by Anthropic,
OpenAI, ZenMux, TrollStore, or the LibreChat maintainers. LibreChat attribution and its MIT license
are preserved below and in [LICENSE](LICENSE).

Repository updates follow the checks in [docs/MAINTENANCE.md](docs/MAINTENANCE.md). Every ChatOne
change should pass `npm run test:chatone`, a production Docker build, a macOS build, and a secret
scan before it is pushed to the public `main` branch.

```bash
node custom/scripts/setup-env.mjs
# Add ZENMUX_API_KEY to .env
node custom/scripts/sync-models.mjs
docker compose build api
docker compose up -d
```

## Native macOS app

After the Docker setup has created the ChatOne containers once, build the native AppKit/WebKit
client with:

```bash
npm run macos:build
open "dist/ChatOne.app"
```

The app checks the local LibreChat health endpoint and starts the existing MongoDB, Meilisearch,
and LibreChat containers when needed. It never reads or stores `ZENMUX_API_KEY`; the key remains in
the server-side Docker environment. See [custom/macos/README.md](custom/macos/README.md).

### GPT through the ChatGPT subscription

The model selector exposes every model reported by the authenticated `openai-codex` provider:
GPT 5.6 Sol, Terra and Luna, GPT 5.5, GPT 5.4, GPT 5.4 mini, and GPT 5.3 Codex Spark. Requests use
the ChatGPT subscription allowance rather than ZenMux API balance.

```bash
zsh custom/codex-bridge/install-launch-agent.sh
curl http://127.0.0.1:4317/v1/models
```

## Native iOS app

The SwiftUI/WebKit iPhone and iPad client reuses the same LibreChat account, conversations, file
uploads, model selector, streaming and ZenMux Web Search. It stores only the non-secret server URL
and persistent LibreChat web session; `ZENMUX_API_KEY` remains in the Docker API environment.

```bash
npm run ios:prepare
npm run ios:build
npm run ios:run
open custom/ios/ChatOne.xcodeproj
```

Simulator uses `http://127.0.0.1:3080`. A physical iPhone shows a first-launch server screen for the
Mac LAN URL or a private HTTPS deployment. See [custom/ios/README.md](custom/ios/README.md).

## Native web search

ZenMux's Anthropic-compatible models retain their native server-side web search option. The local
GPT subscription bridge handles chat, reasoning, streaming, images, cancellation, and live web
search. Current-information questions use Bing's public RSS search with the bundled, local-only
SearXNG service as a fallback. The bridge safely reads a few top public HTTPS pages so the answer is
based on page content rather than snippets alone. Weather questions also use Open-Meteo structured
forecast data. Search results and source links are added to the model context; no search credential
or ChatGPT OAuth credential is sent to the browser.

Before every enabled turn, a lightweight subscription model reviews the recent conversation and
decides whether an accurate answer needs current external information. It resolves short follow-ups,
generates one or two search-engine queries, and skips retrieval for stable explanations, writing,
translation, and other self-contained requests. This contextual decision is the general gateway;
weather and A-share handlers are optional structured enrichers after retrieval has been selected,
not hard-coded gates. Each structured response contains its retrieval time and source links and
falls back independently if an optional source is temporarily unavailable.

```bash
docker compose up -d searxng
curl 'http://127.0.0.1:8088/search?q=Hangzhou+weather&format=json'
```

SearXNG is published on `127.0.0.1:8088` only. GPT subscription presets deliberately do not enable
LibreChat's separate paid-search preset: the loopback subscription bridge owns this path and keeps
the existing streaming `/v1/chat/completions` integration stable.

Search queries are sent to Bing or the public engines enabled in SearXNG. Page reading accepts HTTPS
only, validates redirects and resolved addresses, blocks local/private targets, limits downloads,
and supports the Mac's Clash fake-IP DNS mode without allowing literal fake-IP URLs.

The curated model registry also records ZenMux's context metadata. LibreChat receives a safe 90%
working budget for each favorite model, while endpoint token metadata prevents provider-prefixed
ZenMux IDs from falling back to an incorrect 1K context window.

The upstream LibreChat README continues below.

<p align="center">
  <a href="https://librechat.ai">
    <img src="client/public/assets/logo.svg" height="256">
  </a>
  <h1 align="center">
    <a href="https://librechat.ai">LibreChat</a>
  </h1>
</p>

<p align="center">
  <strong>English</strong> ·
  <a href="README.zh.md">中文</a>
</p>

<p align="center">
  <a href="https://discord.librechat.ai"> 
    <img
      src="https://img.shields.io/discord/1086345563026489514?label=&logo=discord&style=for-the-badge&logoWidth=20&logoColor=white&labelColor=000000&color=blueviolet">
  </a>
  <a href="https://www.youtube.com/@LibreChat"> 
    <img
      src="https://img.shields.io/badge/YOUTUBE-red.svg?style=for-the-badge&logo=youtube&logoColor=white&labelColor=000000&logoWidth=20">
  </a>
  <a href="https://docs.librechat.ai"> 
    <img
      src="https://img.shields.io/badge/DOCS-blue.svg?style=for-the-badge&logo=read-the-docs&logoColor=white&labelColor=000000&logoWidth=20">
  </a>
  <a aria-label="Sponsors" href="https://github.com/sponsors/danny-avila">
    <img
      src="https://img.shields.io/badge/SPONSORS-brightgreen.svg?style=for-the-badge&logo=github-sponsors&logoColor=white&labelColor=000000&logoWidth=20">
  </a>
</p>

<p align="center">
<a href="https://railway.com/deploy/librechat-official?referralCode=HI9hWz&utm_medium=integration&utm_source=readme&utm_campaign=librechat">
  <img src="https://railway.com/button.svg" alt="Deploy on Railway" height="30">
</a>
<a href="https://zeabur.com/templates/0X2ZY8">
  <img src="https://zeabur.com/button.svg" alt="Deploy on Zeabur" height="30"/>
</a>
<a href="https://template.cloud.sealos.io/deploy?templateName=librechat">
  <img src="https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg" alt="Deploy on Sealos" height="30">
</a>
</p>

<p align="center">
  <a href="https://www.librechat.ai/docs/translation">
    <img 
      src="https://img.shields.io/badge/dynamic/json.svg?style=for-the-badge&color=2096F3&label=locize&query=%24.translatedPercentage&url=https://api.locize.app/badgedata/4cb2598b-ed4d-469c-9b04-2ed531a8cb45&suffix=%+translated" 
      alt="Translation Progress">
  </a>
</p>

# ✨ Features

- 🖥️ **UI & Experience** inspired by ChatGPT with enhanced design and features

- 🤖 **AI Model Selection**:
  - Anthropic (Claude), AWS Bedrock, OpenAI, Azure OpenAI, Google, Vertex AI, OpenAI Responses API (incl. Azure)
  - [Custom Endpoints](https://www.librechat.ai/docs/quick_start/custom_endpoints): Use any OpenAI-compatible API with LibreChat, no proxy required
  - Compatible with [Local & Remote AI Providers](https://www.librechat.ai/docs/configuration/librechat_yaml/ai_endpoints):
    - Ollama, groq, Cohere, Mistral AI, Apple MLX, koboldcpp, together.ai,
    - OpenRouter, Helicone, Perplexity, ShuttleAI, Deepseek, Qwen, and more

- 🔧 **[Code Interpreter API](https://www.librechat.ai/docs/features/code_interpreter)**:
  - Secure, Sandboxed Execution in Python, Node.js (JS/TS), Go, C/C++, Java, PHP, Rust, and Fortran
  - Seamless File Handling: Upload, process, and download files directly
  - No Privacy Concerns: Fully isolated and secure execution
  - Open-Source & Self-Hostable: powered by [ClickHouse/code-interpreter](https://github.com/ClickHouse/code-interpreter)

- 🔦 **Agents & Tools Integration**:
  - **[LibreChat Agents](https://www.librechat.ai/docs/features/agents)**:
    - No-Code Custom Assistants: Build specialized, AI-driven helpers
    - Agent Marketplace: Discover and deploy community-built agents
    - Collaborative Sharing: Share agents with specific users and groups
    - Flexible & Extensible: Use MCP Servers, tools, file search, code execution, and more
    - [Skills](https://www.librechat.ai/docs/features/skills): Create reusable `SKILL.md` instruction bundles for manual, automatic, or always-on agent workflows
    - [Subagents](https://www.librechat.ai/docs/features/subagents): Delegate focused work to isolated child agent runs with their own context windows
    - Compatible with Custom Endpoints, OpenAI, Azure, Anthropic, AWS Bedrock, Google, Vertex AI, Responses API, and more
    - [Model Context Protocol (MCP) Support](https://modelcontextprotocol.io/clients#librechat) for Tools

- 🔍 **Web Search**:
  - Search the internet and retrieve relevant information to enhance your AI context
  - Combines search providers, content scrapers, and result rerankers for optimal results
  - **Customizable Jina Reranking**: Configure custom Jina API URLs for reranking services
  - **[Learn More →](https://www.librechat.ai/docs/features/web_search)**

- 🪄 **Generative UI with Code Artifacts**:
  - [Code Artifacts](https://youtu.be/GfTj7O4gmd0?si=WJbdnemZpJzBrJo3) allow creation of React, HTML, and Mermaid diagrams directly in chat

- 🎨 **Image Generation & Editing**
  - Text-to-image and image-to-image with [GPT-Image-1](https://www.librechat.ai/docs/features/image_gen#1--openai-image-tools-recommended)
  - Text-to-image with [DALL-E (3/2)](https://www.librechat.ai/docs/features/image_gen#2--dalle-legacy), [Stable Diffusion](https://www.librechat.ai/docs/features/image_gen#3--stable-diffusion-local), [Flux](https://www.librechat.ai/docs/features/image_gen#4--flux), or any [MCP server](https://www.librechat.ai/docs/features/image_gen#5--model-context-protocol-mcp)
  - Produce stunning visuals from prompts or refine existing images with a single instruction

- 💾 **Presets & Context Management**:
  - Create, Save, & Share Custom Presets
  - Switch between AI Endpoints and Presets mid-chat
  - Edit, Resubmit, and Continue Messages with Conversation branching
  - Create and share prompts with specific users and groups
  - [Fork Messages & Conversations](https://www.librechat.ai/docs/features/fork) for Advanced Context control

- 💬 **Multimodal & File Interactions**:
  - Upload and analyze images with Claude 3, GPT-4.5, GPT-4o, o1, Llama-Vision, and Gemini 📸
  - Chat with Files using Custom Endpoints, OpenAI, Azure, Anthropic, AWS Bedrock, & Google 🗃️

- 🌎 **Multilingual UI**:
  - English, 中文 (简体), 中文 (繁體), العربية, Deutsch, Español, Français, Italiano
  - Polski, Português (PT), Português (BR), Русский, 日本語, Svenska, 한국어, Tiếng Việt
  - Türkçe, Nederlands, עברית, Català, Čeština, Dansk, Eesti, فارسی
  - Suomi, Magyar, Հայերեն, Bahasa Indonesia, ქართული, Latviešu, ไทย, ئۇيغۇرچە

- 🧠 **Reasoning UI**:
  - Dynamic Reasoning UI for Chain-of-Thought/Reasoning AI models like DeepSeek-R1

- 🎨 **Customizable Interface**:
  - Customizable Dropdown & Interface that adapts to both power users and newcomers

- 🌊 **[Resumable Streams](https://www.librechat.ai/docs/features/resumable_streams)**:
  - Never lose a response: AI responses automatically reconnect and resume if your connection drops
  - Multi-Tab & Multi-Device Sync: Open the same chat in multiple tabs or pick up on another device
  - Production-Ready: Works from single-server setups to horizontally scaled deployments with Redis

- 🗣️ **Speech & Audio**:
  - Chat hands-free with Speech-to-Text and Text-to-Speech
  - Automatically send and play Audio
  - Supports OpenAI, Azure OpenAI, and Elevenlabs

- 📥 **Import & Export Conversations**:
  - Import Conversations from LibreChat, ChatGPT, Chatbot UI
  - Export conversations as screenshots, markdown, text, json

- 🔍 **Search & Discovery**:
  - Search all messages/conversations

- 👥 **Multi-User & Secure Access**:
  - Multi-User, Secure Authentication with OAuth2, LDAP, & Email Login Support
  - Built-in Moderation, and Token spend tools

- 🎛️ **[Admin Panel](https://www.librechat.ai/docs/features/admin_panel)**:
  - Browser-based UI to manage users, groups, roles, and configuration overrides
  - Edit settings and per-role/group permissions live, without redeploying
  - Bundled with the Docker Compose stacks for one-command setup

- ⚙️ **Configuration & Deployment**:
  - Configure Proxy, Reverse Proxy, Docker, & many Deployment options
  - Use [S3 with CloudFront](https://www.librechat.ai/docs/configuration/cdn/cloudfront) for stable media links, edge delivery, signed cookies, and secured downloads
  - Use completely local or deploy on the cloud

- 📖 **Open-Source & Community**:
  - Completely Open-Source & Built in Public
  - Community-driven development, support, and feedback

[For a thorough review of our features, see our docs here](https://docs.librechat.ai/) 📚

## 🪶 All-In-One AI Conversations with LibreChat

LibreChat is a self-hosted AI chat platform that unifies all major AI providers in a single, privacy-focused interface.

Beyond chat, LibreChat provides AI Agents, Model Context Protocol (MCP) support, Artifacts, Code Interpreter, custom actions, conversation search, and enterprise-ready multi-user authentication.

Open source, actively developed, and built for anyone who values control over their AI infrastructure.

---

## 🌐 Resources

**GitHub Repo:**

- **RAG API:** [github.com/danny-avila/rag_api](https://github.com/danny-avila/rag_api)
- **Website:** [github.com/LibreChat-AI/librechat.ai](https://github.com/LibreChat-AI/librechat.ai)

**Other:**

- **Website:** [librechat.ai](https://librechat.ai)
- **Documentation:** [librechat.ai/docs](https://librechat.ai/docs)
- **Blog:** [librechat.ai/blog](https://librechat.ai/blog)

---

## 📝 Changelog

Keep up with the latest updates by visiting the releases page and notes:

- [Releases](https://github.com/danny-avila/LibreChat/releases)
- [Changelog](https://www.librechat.ai/changelog)

**⚠️ Please consult the [changelog](https://www.librechat.ai/changelog) for breaking changes before updating.**

---

## ⭐ Star History

<p align="center">
  <a href="https://star-history.com/#danny-avila/LibreChat&Date">
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=danny-avila/LibreChat&type=Date&theme=dark" onerror="this.src='https://api.star-history.com/svg?repos=danny-avila/LibreChat&type=Date'" />
  </a>
</p>
<p align="center">
  <a href="https://trendshift.io/repositories/4685" target="_blank" style="padding: 10px;">
    <img src="https://trendshift.io/api/badge/repositories/4685" alt="danny-avila%2FLibreChat | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <a href="https://runacap.com/ross-index/q1-24/" target="_blank" rel="noopener" style="margin-left: 20px;">
    <img style="width: 260px; height: 56px" src="https://runacap.com/wp-content/uploads/2024/04/ROSS_badge_white_Q1_2024.svg" alt="ROSS Index - Fastest Growing Open-Source Startups in Q1 2024 | Runa Capital" width="260" height="56"/>
  </a>
</p>

---

## ✨ Contributions

Contributions, suggestions, bug reports and fixes are welcome!

For new features, components, or extensions, please open an issue and discuss before sending a PR.

If you'd like to help translate LibreChat into your language, we'd love your contribution! Improving our translations not only makes LibreChat more accessible to users around the world but also enhances the overall user experience. Please check out our [Translation Guide](https://www.librechat.ai/docs/translation).

---

## 💖 This project exists in its current state thanks to all the people who contribute

<a href="https://github.com/danny-avila/LibreChat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=danny-avila/LibreChat" />
</a>

---

## 🎉 Special Thanks

We thank [Locize](https://locize.com) for their translation management tools that support multiple languages in LibreChat.

<p align="center">
  <a href="https://locize.com" target="_blank" rel="noopener noreferrer">
    <img src="https://github.com/user-attachments/assets/d6b70894-6064-475e-bb65-92a9e23e0077" alt="Locize Logo" height="50">
  </a>
</p>
