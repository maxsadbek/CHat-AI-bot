# Secrets Rotation Checklist

> This document lists every secret that must be rotated when transferring the project to a new owner.
> Follow the ORDER specified — rotating in the wrong order can cause service disruption.

---

## ⚠️ Important: Rotation Order

Rotate in this exact order to minimize downtime:

```
 1. Database (DATABASE_URL)        ← Do First (foundation)
 2. Telegram Bot Token             ← Do Second (requires new DB secret)
 3. Webhook Secret                 ← Do Third (requires new bot token)
 4. Admin Secret + IDs             ← Do Fourth (requires webhook active)
 5. AI Provider Keys               ← Do Fifth (can be done in any order)
 6. Payment Keys (Stripe)          ← Do Last (requires everything else working)
 7. Upstash Redis (if used)        ← Optional, can be done anytime
```

---

## 1. Database (`DATABASE_URL`)

| Item | Detail |
|------|--------|
| **Where used** | `prisma/schema.prisma`, `config/index.ts` |
| **What it protects** | All user data, subscriptions, payments, conversations, settings |
| **Why rotate** | Old owner retains access to all data after sale |
| **New value source** | Create a new PostgreSQL instance (e.g., on Neon, Supabase, or your own server) |
| **Migration needed?** | Yes — run `npx prisma db push` on the new database |
| **Data transfer** | If data must be preserved, use `pg_dump` / `pg_restore` |

### Steps
```bash
# 1. Create new PostgreSQL database
# 2. Get the connection string
DATABASE_URL=postgresql://user:password@new-host:5432/new_database

# 3. Push schema to new DB
npx prisma generate
npx prisma db push

# 4. If migrating data:
pg_dump --no-owner OLD_DATABASE_URL > backup.sql
psql NEW_DATABASE_URL < backup.sql

# 5. Update .env and deploy
```

---

## 2. Telegram Bot Token (`TELEGRAM_BOT_TOKEN`)

| Item | Detail |
|------|--------|
| **Where used** | `config/index.ts`, `app/api/webhook/route.ts` |
| **What it protects** | Bot identity — who can send messages as the bot |
| **Why rotate** | Old owner could revoke or hijack the bot |
| **New value source** | [@BotFather](https://t.me/BotFather) → `/revoke` → `/token` to get a new token |
| **Impact** | Bot stops working until webhook is re-set with new token |

### Steps
```bash
# 1. In Telegram, message @BotFather:
/revoke      (then select your bot)
/token       (then select your bot to get new token)

# 2. Update .env with new token
TELEGRAM_BOT_TOKEN=new_token_here

# 3. Re-set webhook with new token
npm run set-webhook
```

---

## 3. Webhook Secret (`TELEGRAM_WEBHOOK_SECRET`)

| Item | Detail |
|------|--------|
| **Where used** | `app/api/webhook/route.ts`, `scripts/set-webhook.ts` |
| **What it protects** | Prevents fake updates being sent to the webhook endpoint |
| **Why rotate** | Old owner knows the secret and could send fake Telegram updates |
| **New value source** | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| **Impact** | Webhook rejects ALL requests until re-set |

### Steps
```bash
# 1. Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6... (64 hex characters)

# 2. Update .env
TELEGRAM_WEBHOOK_SECRET=new_64_char_hex

# 3. Re-set webhook (sends new secret_token to Telegram)
npm run set-webhook
```

---

## 4. Admin Secret + Admin IDs

### 4a. `ADMIN_SECRET`

| Item | Detail |
|------|--------|
| **Where used** | All `app/api/admin/*` routes, `services/admin/admin-guard.ts` |
| **What it protects** | Admin dashboard, user management, premium controls, analytics |
| **Why rotate** | Old owner could access and modify user data, grant themselves premium |
| **New value source** | Must be 24+ random characters. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| **Validation** | Must NOT be "admin-secret", "changeme", "secret", "password", "admin", or less than 24 characters |

### 4b. `ADMIN_IDS`

| Item | Detail |
|------|--------|
| **Where used** | `config/index.ts`, `services/admin/admin-guard.ts` |
| **What it protects** | Admin commands within the Telegram bot |
| **Why rotate** | Old owner's Telegram ID should be removed; new owner's ID added |
| **New value source** | New owner's Telegram user ID (get from [@userinfobot](https://t.me/userinfobot) or `/id`) |

### Steps
```bash
# 1. Generate new ADMIN_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Update .env
ADMIN_SECRET=new_64_char_hex
ADMIN_IDS=new_owner_telegram_id

# 3. Deploy
```

---

## 5. AI Provider API Keys

| Key | Where to Get |
|-----|-------------|
| `GEMINI_API_KEY` | [Google AI Studio](https://makersuite.google.com/app/apikey) — revoke old key, create new |
| `OPENAI_API_KEY` | [OpenAI Dashboard](https://platform.openai.com/api-keys) |
| `CEREBRAS_API_KEY` | [Cerebras Console](https://cloud.cerebras.ai/) |
| `MISTRAL_API_KEY` | [Mistral Platform](https://console.mistral.ai/) |
| `OPENROUTER_API_KEY` | [OpenRouter Keys](https://openrouter.ai/keys) |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) |
| `DEEPSEEK_API_KEY` | [DeepSeek Platform](https://platform.deepseek.com/) |
| `STABILITY_API_KEY` | [Stability AI Platform](https://platform.stability.ai/) |
| `FLUX_API_KEY` | [BFL API](https://api.bfl.ml/) |

Rotate ALL keys, even if currently unused. Old owner could enable and use them.

---

## 6. Payment Keys (Stripe)

| Key | Where to Get |
|-----|-------------|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) — roll keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → re-create endpoint, get new signing secret |

### Steps
```bash
# 1. In Stripe Dashboard → Developers → API Keys → Roll keys
# 2. In Stripe Dashboard → Developers → Webhooks → Add endpoint:
#    URL: https://your-domain.vercel.app/api/webhook/payment/stripe
# 3. Copy new webhook signing secret
# 4. Update .env
```

**Important**: If using manual payments (Click/PayMe), update the card details and prices in env vars:
- `MANUAL_PAYMENT_CARD_NAME`
- `MANUAL_PAYMENT_CARD_NUMBER`
- `MANUAL_PAYMENT_AMOUNT_UZS`
- `MANUAL_PAYMENT_PRICE_USD`

---

## 7. Upstash Redis (Optional)

| Key | Where to Get |
|-----|-------------|
| `UPSTASH_REDIS_REST_URL` | [Upstash Console](https://console.upstash.com/) → Create new Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Same location |

Rotate if rate limiting data privacy is a concern. Without Redis, the app defaults to in-memory rate limiting (with a warning).

---

## Post-Rotation Smoke Test

After rotating ALL secrets, verify:

```bash
# 1. Bot responds to commands
#    → Send /start to the bot → Should see welcome message

# 2. AI generation works
#    → Send /business → Enter an idea → Should get analysis

# 3. Admin dashboard accessible
#    → Visit https://your-domain.vercel.app/admin
#    → Should load with stats

# 4. Admin API works (with new ADMIN_SECRET)
curl -H "Authorization: Bearer NEW_ADMIN_SECRET" \
     https://your-domain.vercel.app/api/admin/stats
#    → Should return 200 with JSON

# 5. Webhook rejects unauthenticated requests
curl -X POST https://your-domain.vercel.app/api/webhook
#    → Should return 401
```

---

## Quick Reference: All Env Vars to Rotate

| # | Variable | Rotation Method | Priority |
|---|----------|----------------|----------|
| 1 | `DATABASE_URL` | Create new DB instance | 🔴 Critical |
| 2 | `TELEGRAM_BOT_TOKEN` | @BotFather → /revoke → /token | 🔴 Critical |
| 3 | `TELEGRAM_WEBHOOK_SECRET` | `crypto.randomBytes(32).toString('hex')` | 🔴 Critical |
| 4 | `ADMIN_SECRET` | `crypto.randomBytes(32).toString('hex')` (24+ chars) | 🔴 Critical |
| 5 | `ADMIN_IDS` | Replace with new owner's Telegram ID | 🔴 Critical |
| 6 | `GEMINI_API_KEY` | Google AI Studio → revoke → create new | 🟡 High |
| 7 | All other AI API keys | Respective provider dashboards | 🟡 High |
| 8 | `STRIPE_SECRET_KEY` | Stripe Dashboard → Roll keys | 🟡 High |
| 9 | `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → re-create | 🟡 High |
| 10 | `UPSTASH_REDIS_*` | Upstash Console → new Redis DB | 🟢 Medium |
| 11 | `MANUAL_PAYMENT_*` | Change card details, prices | 🟢 Medium |
