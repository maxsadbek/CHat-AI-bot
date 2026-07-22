# 🤖 AI Creator Studio

> A premium Telegram AI platform for content creation, coding, and business growth.

AI Creator Studio is a production-ready Telegram bot built with Next.js 16, TypeScript, grammY, and Prisma. It provides a comprehensive suite of AI-powered tools including chat, video/image prompt generation, social media content creation, coding assistance, business strategy, and translation — all delivered through a beautiful, premium Telegram experience.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat** | ChatGPT-like conversations with memory |
| 🎬 **Video AI** | Professional prompts for Hailuo, Kling, Veo, Runway, PixVerse |
| 🎨 **Image AI** | Detailed prompts for GPT Image, Flux, Midjourney, Leonardo, Ideogram |
| 📱 **Social Media** | Platform-optimized content for Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube |
| 💻 **Coding** | Generate, debug, and explain code in 10+ languages |
| 💼 **Business** | Startup ideas, business plans, marketing strategies, branding |
| 🌍 **Translate** | AI-powered translation between any languages |
| ⚙️ **Profile** | Usage stats, subscription management, settings |

## 🚀 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (strict mode)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Bot Framework:** [grammY](https://grammy.dev/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) via [Prisma](https://www.prisma.io/)
- **AI Provider:** OpenAI-compatible API
- **Deployment:** [Vercel](https://vercel.com/) (serverless)

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── webhook/        # Telegram webhook handler
│   │   └── admin/          # Admin API endpoints
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── bot/
│   ├── handlers/           # Bot command handlers
│   │   ├── start.ts        # Welcome message
│   │   ├── ai-chat.ts      # AI conversation
│   │   ├── video.ts        # Video prompts
│   │   ├── image.ts        # Image prompts
│   │   ├── social.ts       # Social media
│   │   ├── business.ts     # Business content
│   │   ├── coding.ts       # Code generation
│   │   ├── translate.ts    # Translation
│   │   ├── profile.ts      # User profile
│   │   └── help.ts         # Help guide
│   ├── keyboards/          # Inline keyboards
│   ├── middleware/         # Bot middleware
│   └── index.ts            # Bot setup
├── components/ui/          # UI components
├── config/                 # App configuration
├── lib/                    # Core library files
├── services/
│   ├── ai/                 # AI services
│   └── admin/              # Admin service
├── types/                  # TypeScript types
├── utils/                  # Utility functions
├── prisma/                 # Database schema
├── scripts/                # Utility scripts
└── middleware/             # Edge middleware
```

## 🛠️ Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- OpenAI API key (or compatible provider)

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/ai-creator-studio.git
cd ai-creator-studio
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Fill in your environment variables:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `TELEGRAM_WEBHOOK_URL` | Your deployment URL (e.g., `https://your-app.vercel.app`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_BASE_URL` | OpenAI API base URL (default: `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | Model to use (default: `gpt-4o-mini`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_IDS` | Comma-separated Telegram user IDs for admin access |
| `ADMIN_SECRET` | Secret key for admin API access |

4. **Set up the database**

```bash
npx prisma generate
npx prisma db push
```

5. **Run development server**

```bash
npm run dev
```

## 🌐 Deploy to Vercel

1. Push your code to a GitHub repository
2. Import the project in [Vercel](https://vercel.com/new)
3. Add all environment variables from `.env`
4. Deploy!

### Set Webhook

After deployment, set your Telegram webhook:

```bash
TELEGRAM_BOT_TOKEN=your_token TELEGRAM_WEBHOOK_URL=https://your-app.vercel.app npx tsx scripts/set-webhook.ts
```

## 🔧 Webhook Setup

The bot uses webhooks (not polling) for optimal serverless performance:

1. Deploy your app to Vercel
2. Run the webhook setup script with your deployed URL
3. The webhook endpoint is: `https://your-app.vercel.app/api/webhook`

## 🗄️ Database Schema

- **User** — Telegram user accounts and usage tracking
- **Conversation** — Chat conversations with history
- **Message** — Individual messages in conversations
- **Usage** — Feature usage tracking
- **Subscription** — Premium subscription management
- **UserSettings** — User preferences
- **AdminLog** — Admin activity logs

## 🔒 Security

- Rate limiting on all bot interactions
- Input validation with Zod
- Admin-only endpoints protected by secret token
- Environment variable validation at startup
- PostgreSQL with parameterized queries via Prisma

## 📊 Admin Panel

Admin endpoints (protected by `ADMIN_SECRET`):

- `GET /api/admin/stats` — Dashboard statistics
- `GET /api/admin/users` — User management
- `POST /api/admin/broadcast` — Message broadcasting
- `GET /api/admin/logs` — Activity logs

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [grammY](https://grammy.dev/) — Telegram Bot Framework
- [Next.js](https://nextjs.org/) — React Framework
- [Prisma](https://www.prisma.io/) — Database ORM
- [OpenAI](https://openai.com/) — AI Provider
- [Tailwind CSS](https://tailwindcss.com/) — CSS Framework

---

<p align="center">Built with ❤️ by <a href="https://github.com/maxsadbek">Maxsadbek</a></p>
