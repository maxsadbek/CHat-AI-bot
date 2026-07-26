# Kayzel Creator — AI Telegram SaaS Bot

> Premium Telegram bot for content creation, coding assistance, business strategy, and AI-powered creativity.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma)](https://www.prisma.io/)
[![grammY](https://img.shields.io/badge/grammY-0.9.x-0088CC)](https://grammy.dev/)

---

## 🚀 Features

### AI-Powered Tools
- **💬 Chat** — Context-aware conversations with memory, history, and resume
- **🎬 Video Prompts** — Cinematic prompts for Hailuo AI, Kling, Veo, Runway, PixVerse
- **🖼️ Image Prompts** — Detailed prompts for Flux, Midjourney, Leonardo, Ideogram, GPT Image
- **📱 Social Media** — Platform-optimized content for Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube
- **💻 Coding** — Code generation, debugging, and explanations in 12+ languages
- **💼 Business** — Startup analysis, business plans, marketing strategies, branding (names, slogans, logos, colors, landing pages)
- **🌐 Translation** — AI-powered multilingual translation

### Subscription Tiers
| Plan | Requests/Day | Token Limit | Models |
|------|-------------|-------------|--------|
| **FREE** | Limited | 400–800 tokens | Standard providers |
| **PREMIUM** | Higher limits | 800–2000 tokens | Priority routing |
| **PRO** | Max limits | 4000–24000 tokens | Best models |
| **ENTERPRISE** | Unlimited | 8000–48000 tokens | Highest priority |

### Admin Dashboard
- Real-time system monitoring (users, requests, tokens)
- User management with search and pagination
- Analytics with usage breakdowns
- Premium subscription management
- Activity logs
- System health checks

---

## 🏗️ Architecture

```
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── admin/          #   Admin endpoints (stats, users, analytics, premium, logs, broadcast, health)
│   │   ├── payments/       #   Payment processing
│   │   └── webhook/        #   Telegram webhook
│   ├── admin/              # Admin dashboard UI pages
│   ├── premium/            # Premium subscription pages
│   ├── layout.tsx          # Root layout (global styles)
│   └── page.tsx            # Landing page
├── bot/                    # Telegram bot
│   ├── handlers/           # Feature handlers (ai-chat, business, coding, image, social, video, translate...)
│   ├── core/               # Bot core (router, error-handler, logger, session-manager)
│   ├── middleware/          # Bot middleware (rate-limit, user tracking, daily limits)
│   ├── keyboards/          # Inline keyboards
│   ├── localization.ts     # i18n (EN, RU, UZ)
│   ├── session.ts          # Session management
│   └── ui/                 # Premium UI formatting
├── components/ui/          # Reusable UI components
├── config/                 # Configuration
│   ├── ai.ts               # AI config, models, token policies, provider settings
│   ├── index.ts            # Env config
│   └── plans.ts            # Subscription plans
├── lib/                    # Library code (Prisma client, OpenAI client)
├── locales/                # i18n translation files (en, ru, uz)
├── prisma/                 # Prisma schema and migrations
├── repositories/           # Data access layer (base, conversation, history, message, payment, project, settings, subscription, usage, user)
└── services/               # Business logic
    ├── admin/              # Admin services (admin-guard, health, premium-management, user-management)
    ├── ai/                 # AI pipeline
    │   ├── core/           #   AI executor
    │   ├── providers/      #   Provider implementations (gemini, cerebras, mistral, openrouter, openai, claude, groq, deepseek, flux, stability, ollama)
    │   ├── router/         #   AI router (route-planner, health, cache, usage-tracker)
    │   ├── strategies/     #   Cost optimization, fallback, retry
    │   ├── types/          #   Error types
    │   ├── utils/          #   Logger
    │   ├── chat.ts         #   Chat service
    │   ├── business.ts     #   Business AI service
    │   ├── coding.ts       #   Coding AI service
    │   ├── image.ts        #   Image AI service
    │   └── ...             #   Social, video, translate
    ├── analytics/          # Analytics service
    ├── conversation/       # Conversation service
    ├── history/            # History service
    ├── payment/            # Payment service (Stripe)
    ├── project/            # Project service
    ├── subscription/       # Subscription service
    ├── usage/              # Usage tracking service
    └── user/               # User service
├── types/                  # TypeScript type definitions
└── utils/                  # Utility functions (helpers, markdown, rate-limit, platform-slugs)
```

### AI Provider Failover Chain
```
Chat/Coding/Business/Social/Translate:
  Gemini → Cerebras → Mistral → OpenRouter

Image Prompt Generation:
  Gemini → Cerebras → Mistral → OpenRouter

Video Prompt Generation:
  Gemini → Cerebras → Mistral → OpenRouter

Actual Image Generation (Flux/Stability):
  Provider-specific APIs (bypasses router)
```

---

## 📦 Installation

### Prerequisites
- **Node.js** 18+ (20+ recommended)
- **PostgreSQL** 14+
- **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather))
- At least one **AI API key** (Gemini recommended — free tier available)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/kayzel-creator.git
cd kayzel-creator

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# 4. Initialize database
npx prisma generate
npx prisma db push

# 5. Set Telegram webhook
npm run set-webhook

# 6. Run development server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from BotFather |
| `TELEGRAM_WEBHOOK_URL` | ✅ | Public URL for webhook (e.g., `https://your-domain.com/api/webhook`) |
| `TELEGRAM_WEBHOOK_SECRET` | ✅ | **SECURITY CRITICAL** — Random 32+ char hex string. Telegram sends this with every webhook. Without it, anyone can send fake updates to your bot. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `ADMIN_IDS` | ✅ | Comma-separated Telegram user IDs for admin access |
| `ADMIN_SECRET` | ✅ | **SECURITY CRITICAL** — Admin API secret. Must be at least 24 random characters. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GEMINI_API_KEY` | * | **Recommended** — Google Gemini API key (lowest cost, highest free tier limits) |
| `CEREBRAS_API_KEY` | * | Cerebras API key |
| `MISTRAL_API_KEY` | * | Mistral AI API key |
| `OPENROUTER_API_KEY` | * | OpenRouter API key |
| *At least one AI provider API key required* | |

See `.env.example` for all optional configuration variables.

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Configure Telegram webhook URL to point to your Vercel deployment
npm run set-webhook
```

### Manual Deployment

```bash
# Build
npm run build

# Start
npm start
```

---

## 🧪 Development

```bash
# Run development server with hot reload
npm run dev

# TypeScript compilation check
npx tsc --noEmit

# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database
npx prisma db push

# Open Prisma Studio (GUI database browser)
npx prisma studio
```

---

## 🔒 Security

- **API authentication**: Admin endpoints protected by `ADMIN_SECRET` header (timing-safe comparison via `crypto.timingSafeEqual`)
- **Rate limiting**: Per-user rate limiting (Upstash Redis on serverless, in-memory fallback)
- **Webhook verification**: `TELEGRAM_WEBHOOK_SECRET` sent as `secret_token` to Telegram; verified with timing-safe comparison on every request — unauthorized requests are rejected immediately with 401
- **ADMIN_SECRET validation**: At startup, checks for weak/default values and minimum length (24+ chars). In production, exits with clear error if insecure
- **Daily limits**: Per-feature daily request limits for free/premium users
- **Environment isolation**: All secrets via environment variables
- **Input validation**: Zod schemas for API payloads

---

## 📊 Monitoring

The admin dashboard at `/admin` provides:
- Real-time system statistics
- User management (search, pagination)
- Usage analytics (features, tokens, trends)
- Premium subscription overview
- Activity logs
- System health monitoring

---

## 📄 License

This project is available for acquisition. License terms to be negotiated with the new owner.

---

## 🙏 Acknowledgments

- [grammY](https://grammy.dev/) — Telegram Bot Framework
- [Next.js](https://nextjs.org/) — React Framework
- [Prisma](https://www.prisma.io/) — Database ORM
- [Google Gemini](https://deepmind.google/technologies/gemini/) — AI Provider
