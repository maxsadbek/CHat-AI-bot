# Handover Guide

> This guide walks the new owner through taking full control of the Kayzel Creator project.
> Approximate time: **1–2 hours** for experienced developers.

---

## Prerequisites

Before starting, the new owner needs:

- [ ] A **GitHub account** (to own the repository)
- [ ] A **Vercel account** (to host the bot and dashboard)
- [ ] A **Telegram account** (to manage the bot via @BotFather)
- [ ] **PostgreSQL database** (use Neon, Supabase, or your own server)
- [ ] **Node.js 20+** installed locally
- [ ] At least **one AI provider API key** (Gemini recommended — free tier available)

---

## Step 1: Transfer Repository

### Option A: New owner creates a fork (recommended for Marketplace sales)

```bash
# 1. New owner forks the repo on GitHub
# 2. Clones locally
git clone https://github.com/new-owner/kayzel-creator.git
cd kayzel-creator
```

### Option B: Transfer ownership (if both parties have GitHub accounts)

1. Current owner goes to repo Settings → Danger Zone → Transfer ownership
2. Enter new owner's GitHub username
3. Confirm transfer

### Option C: Clean slate (no Git history — removes old author info)

```bash
# 1. Download the source code (without .git folder)
# 2. Initialize fresh repository
git init
git add .
git commit -m "Initial commit — Kayzel Creator"
git remote add origin https://github.com/new-owner/kayzel-creator.git
git push -u origin main
```

> **Recommendation**: Use Option C if privacy is a concern (the old Git history contains author names and emails). Use Option B for ongoing collaboration.

---

## Step 2: Set Up Environment

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local

# 3. Edit .env.local with all new secrets
#    See SECRETS-ROTATION-CHECKLIST.md for detailed instructions
```

---

## Step 3: Create and Configure PostgreSQL Database

### Using Neon (free, serverless, recommended)

```bash
# 1. Go to https://neon.tech
# 2. Sign up → Create project
# 3. Copy the connection string (starts with postgres://)
# 4. Add to .env.local:
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Using Supabase (free, includes auth)

```bash
# 1. Go to https://supabase.com
# 2. Create project
# 3. Go to Project Settings → Database → Connection string
# 4. Add to .env.local
```

### Push Schema

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push

# Optional: Open Prisma Studio to verify
npx prisma studio
```

---

## Step 4: Create Telegram Bot

```bash
# 1. Open Telegram and message @BotFather
# 2. Send /newbot
# 3. Choose a name (e.g., "My Creator Bot")
# 4. Choose a username (must end in "bot", e.g., "MyCreatorBot")
# 5. Copy the token (format: 1234567890:ABCdefGHIjklmNOPqrSTUvwxYZ)
# 6. Add to .env.local:
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklmNOPqrSTUvwxYZ

# 7. Set bot commands (send these to @BotFather):
#    /setcommands → select bot → paste:
start - Main menu
chat - AI Chat
image - Image Prompts
video - Video Prompts
coding - Code Generation
business - Business Analysis
social - Social Media
translate - Translation
help - Help
settings - Settings
profile - My Profile
premium - Premium Subscription
```

---

## Step 5: Generate Webhook Secret

```bash
# Generate a random 64-character hex string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local:
TELEGRAM_WEBHOOK_SECRET=<output_from_command>
```

---

## Step 6: Deploy to Vercel

```bash
# If not already installed:
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
#   → Link to existing Vercel project? No
#   → Project name: kayzel-creator (or your choice)
#   → Directory: ./
#   → Override settings? No

# After deployment, Vercel outputs a URL like:
# https://kayzel-creator-xxx.vercel.app
```

### Set Environment Variables in Vercel

```bash
# Option A: Using Vercel CLI (recommended for bulk)
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_WEBHOOK_URL
vercel env add TELEGRAM_WEBHOOK_SECRET
vercel env add DATABASE_URL
vercel env add ADMIN_SECRET
vercel env add ADMIN_IDS
vercel env add GEMINI_API_KEY
# ... add all env vars from .env.local

# Option B: Using Vercel Dashboard (easier for few vars)
#   1. Go to https://vercel.com/new-owner/kayzel-creator/settings/environment-variables
#   2. Add each variable
```

### Set Webhook URL

```bash
# Update .env.local with your Vercel URL:
TELEGRAM_WEBHOOK_URL=https://kayzel-creator-xxx.vercel.app

# Run the set-webhook script
npm run set-webhook

# Expected output:
# ✅ Webhook set successfully!
#    URL: https://kayzel-creator-xxx.vercel.app/api/webhook
#    Secret token: a1b2c3d4... (64 chars)
```

---

## Step 7: Configure Admin Access

```bash
# 1. Get your Telegram user ID:
#    → Message @userinfobot on Telegram
#    → It will reply with your ID (e.g., 123456789)

# 2. Add to .env.local and Vercel env:
ADMIN_IDS=123456789
ADMIN_SECRET=<generate_random_24+_char_string>
```

---

## Step 8: Add AI Provider Keys

At minimum, add one AI provider:

```bash
# Recommended: Google Gemini (free tier handles thousands of requests)
# Get key: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...
```

Optional providers (add any or all):
```
OPENAI_API_KEY=
CEREBRAS_API_KEY=
MISTRAL_API_KEY=
OPENROUTER_API_KEY=
```

---

## Step 9: Configure Payments (Optional)

### Stripe (for automated subscriptions)

```bash
# 1. Go to https://dashboard.stripe.com/register
# 2. Get API keys from Developers → API Keys
STRIPE_SECRET_KEY=sk_live_...

# 3. Create webhook endpoint in Stripe Dashboard:
#    Endpoint URL: https://your-domain.vercel.app/api/webhook/payment/stripe
#    Events: checkout.session.completed, customer.subscription.updated
# 4. Copy the webhook signing secret:
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Manual Payment (Click / PayMe — Uzbekistan)

```bash
# Set the bank card details shown to users:
MANUAL_PAYMENT_CARD_NAME=Card Holder Name
MANUAL_PAYMENT_CARD_NUMBER=8600123412341234
MANUAL_PAYMENT_AMOUNT_UZS=50000
MANUAL_PAYMENT_PRICE_USD=5.00
```

---

## Step 10: Smoke Test

After deployment, verify everything works:

### Test 1: Bot is alive
```
→ Send /start to the bot on Telegram
→ Expected: Welcome message with Main Menu
```

### Test 2: AI generation works
```
→ Click 💼 Business (or send /business)
→ Type "Telegram marketing bot"
→ Expected: Business analysis with emoji sections
```

### Test 3: Webhook security works
```bash
# Run from terminal — should return 401
curl -X POST https://your-domain.vercel.app/api/webhook
# Expected: {"error":"Unauthorized"}
```

### Test 4: Admin dashboard loads
```
→ Visit https://your-domain.vercel.app/admin
→ Expected: Admin dashboard with stats
```

### Test 5: Admin API works
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
     https://your-domain.vercel.app/api/admin/stats
# Expected: JSON with user stats
```

### Test 6: Premium flow works (if payments configured)
```
→ Send /premium
→ Click a plan
→ Expected: Payment page or instructions
```

---

## Troubleshooting

### "Webhook set" fails with 404
```
→ Check TELEGRAM_BOT_TOKEN is correct
→ Verify the bot was created with @BotFather
```

### Bot doesn't respond to messages
```
→ Check webhook status: curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
→ Look for "last_error_date" — if recent, check Vercel logs
```

### AI returns "All AI providers unavailable"
```
→ Check at least one AI API key is set in Vercel env
→ Verify the key is valid (not expired/revoked)
```

### Prisma connection error
```
→ Verify DATABASE_URL is correct
→ Check if database accepts connections (firewall, SSL)
→ Run: npx prisma db push to verify connection
```

### 500 error on webhook
```
→ Check Vercel function logs in Vercel Dashboard
→ Most common: missing env var, DB timeout, AI provider timeout
```

---

## Post-Handover Checklist

- [ ] GitHub repo transferred to new owner
- [ ] Vercel project under new owner's account
- [ ] All secrets rotated (see SECRETS-ROTATION-CHECKLIST.md)
- [ ] Database created and migrated
- [ ] Telegram bot responds to /start
- [ ] AI generation works for at least one feature
- [ ] Admin dashboard loads
- [ ] Webhook returns 401 for unauthenticated requests
- [ ] New owner knows how to get support (link to docs)
