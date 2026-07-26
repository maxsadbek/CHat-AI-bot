# Kayzel Creator — Business Overview

> AI-powered Telegram bot for content creation, coding, business strategy, and creative tasks.

---

## What It Does

Kayzel Creator is a multi-functional AI assistant that lives inside Telegram. Users interact with it just like another chat contact — they send a message, and the bot responds with AI-generated content. No app to install, no dashboard to learn. The bot can:

- Write and debug code in 12+ programming languages
- Generate professional business analysis and startup strategies
- Create prompts for video generation platforms (Hailuo AI, Kling, Veo, Runway, PixVerse)
- Generate detailed image prompts for design tools (Flux, Midjourney, Leonardo, Ideogram)
- Write platform-optimized social media content (Instagram, TikTok, LinkedIn, YouTube, Telegram)
- Translate between multiple languages
- Have context-aware conversations with full history recall

The product is already built, deployed on Vercel, and uses PostgreSQL (via Prisma ORM) for data persistence. It has a premium subscription system with automated payment processing and an admin dashboard for monitoring and management.

---

## Features (User-Facing)

| Feature | What Users Get |
|---------|---------------|
| **💬 AI Chat** | Context-aware conversations. Users can start a chat, ask questions, get answers, review history, and resume past conversations. |
| **💻 Coding** | Generate code in HTML, CSS, React, Next.js, Node.js, Python, SQL, and more. Debug existing code. Get explanations of complex code. |
| **💼 Business** | Startup analysis, business planning, marketing strategies, brand naming, slogan generation, logo prompt design, color palette creation, landing page copy. |
| **🎬 Video Prompts** | Generate cinematic scene descriptions ready for Hailuo AI, Kling, Google Veo, Runway, PixVerse. |
| **🖼️ Image Prompts** | Create detailed image generation prompts for Flux, Midjourney, Leonardo, Ideogram, GPT Image. |
| **📱 Social Media** | Platform-optimized content for Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube, Twitter. |
| **🌐 Translation** | AI-powered translation between multiple languages. |
| **📁 Projects** | Organize generated content into projects with notes, image history, video history, and file storage. |
| **🔐 Premium** | Unlock higher limits, better AI models, and priority processing. Manual payment (Click/PayMe) and Stripe support. |
| **👑 Admin Panel** | Dashboard with user management, usage analytics, premium oversight, activity logs, system health monitoring, and broadcast messaging. |

---

## Technology Stack & Rationale

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| **Runtime** | Node.js 20+ | Industry standard, largest ecosystem, excellent async performance. |
| **Framework** | Next.js 16 (App Router) | Single project serves both the Telegram webhook AND the admin dashboard UI. No separate frontend server needed. Serverless-ready. |
| **Telegram Bot** | grammY | The most modern Telegram Bot framework for TypeScript. Type-safe, middleware-based architecture, excellent callback router pattern. |
| **Database** | PostgreSQL + Prisma ORM | Reliable, ACID-compliant. Prisma provides type-safe queries and automatic migration generation. Serverless-compatible via connection pooling. |
| **Hosting** | Vercel (Serverless Functions) | **Cost advantage**: No always-on server needed. Pay only for what you use. The webhook scales to zero when idle. Vercel's free tier handles thousands of users. |
| **AI Providers** | Multiple (Gemini, Cerebras, Mistral, OpenRouter) | **No vendor lock-in**: The system automatically fails over between providers. If one API fails, the next is tried. Uses the cheapest available: Gemini as primary (lowest cost, highest free tier limits). |
| **Rate Limiting** | Upstash Redis | Serverless-friendly Redis. Without it, in-memory rate limits reset on every cold start, providing no cross-instance protection. |
| **Payments** | Stripe + Manual (Click/PayMe) | Stripe for automated subscriptions. Manual payment handlers for regions where Stripe is not available (Uzbekistan — Click, PayMe). |

### Why Not
- **Why not a React Native app?** — Telegram bots have zero install friction. Users already have Telegram. No app store approval, no updates to push.
- **Why not own servers?** — Serverless (Vercel) costs near-zero for low traffic and scales automatically. A Telegram bot's traffic is bursty, not steady. Paying for a 24/7 server would be wasted infrastructure spend.
- **Why not OpenAI as primary?** — Gemini is 10–100x cheaper per token with comparable quality. OpenAI is kept as a backup through OpenRouter.

---

## Monetization Model

The bot uses a **freemium subscription model** with four tiers:

| Tier | Daily Requests | Token Budget | Target User |
|------|---------------|-------------|-------------|
| **FREE** | 30 chat / 10 coding / 5 video / etc. | 400–800 tokens per response | Casual users, try-before-buy |
| **PREMIUM** | 300 chat / 100 coding / 50 video / etc. | 800–2000 tokens | Regular power users |
| **PRO** | 100+ per feature | 4000–24000 tokens | Professionals, agencies |
| **ENTERPRISE** | Unlimited | 8000–48000 tokens | Businesses, white-label |

### How It Works

1. A user starts using the bot for free.
2. When they hit a daily limit or want higher quality responses, the bot prompts them to upgrade.
3. The user selects a plan and pays via:
   - **Stripe** (credit card, automated recurring billing)
   - **Manual payment** (Click / PayMe — common in Uzbekistan, admin manually approves)
4. The subscription is recorded in PostgreSQL with `tier`, `planType`, `billingPeriod`, `status`, and `expiresAt`.
5. Premium status affects:
   - **Token limits** — higher limits = more detailed AI responses
   - **Provider routing** — premium users get priority access to faster providers
   - **Daily quotas** — more generations per day

### Database Schema (Simplified)

```
User (id, telegramId, isPremium, dailyLimit, requestsToday)
  └── Subscription (userId, tier, planType, status, billingPeriod,
                     startsAt, expiresAt, autoRenew)
  └── Payment (userId, amount, currency, status, provider)
  └── ManualPayment (userId, amount, receiptFileId, status, adminId)
```

Tier definitions and pricing are in `config/plans.ts` and can be adjusted without code changes.

---

## Extensibility & Roadmap

### Easy to Add New AI Providers

The project uses a **Provider Registry pattern** (`services/ai/providers/registry.ts`). Adding a new AI provider takes ~1 hour:

1. Create a new file in `services/ai/providers/` (e.g., `cohere.ts`)
2. Implement the `AIProvider` interface (just 2 methods: `chat()` and `getModels()`)
3. Register it in `registry.ts`
4. Add API key to `.env`
5. Done — the failover system automatically includes the new provider

Currently supported: Gemini, Cerebras, Mistral, OpenRouter, OpenAI, Claude, Groq, DeepSeek, Ollama, Stability AI, Flux.

### Easy to Add New Features

Each feature (chat, coding, business, image, etc.) is a **self-contained service** in `services/ai/`:
- A service file (e.g., `business.ts`) owns the system prompt, format logic, and API integration
- A handler file (e.g., `bot/handlers/business.ts`) owns the Telegram interaction (keyboards, menus, messages)
- Adding a new feature means: create service + create handler + register route

### Planned / Possible Additions

- **Multi-language support** — Localization system already supports EN, RU, UZ. Adding a new language requires only 2 JSON files.
- **Voice processing** — Telegram voice messages → speech-to-text → AI → response
- **Image generation** — Direct image generation via provider APIs (currently generates prompts, not images)
- **Web search integration** — AI with internet access for current information
- **Team/Workspace accounts** — Multi-user organizations with shared billing
- **API access** — Expose AI features as REST API for external integration
- **Custom branding** — White-label the bot for agencies to resell

### Architecture Highlights That Enable Growth

- **AI failover chain** protects against provider outages — the system tries Gemini → Cerebras → Mistral → OpenRouter automatically
- **Response caching** avoids duplicate AI calls (exact-match, TTL-based)
- **Usage tracking** provides per-user, per-feature analytics for billing and capacity planning
- **Admin dashboard** is 100% web-based (Next.js pages at `/admin`) — no additional setup needed
- **Session persistence** via Prisma means users never lose context, even on serverless cold starts

---

## Current Status

- **Stage**: Production-ready (deployed and running on Vercel)
- **Security**: All 4 critical security issues resolved (webhook auth, admin secret, rate limiting, timing-safe comparison)
- **Testing**: Manual testing verified; no automated test suite yet
- **Documentation**: Complete installation, deployment, and handover guides included
- **License**: MIT (customizable before sale)

---

*This overview is prepared for potential buyers and investors. For technical documentation, see [README.md](./README.md). For current code quality status, see [TECHNICAL-AUDIT.md](./TECHNICAL-AUDIT.md).*
