# Metrics Template

> ⚠️ **Do NOT generate fake metrics.** Fill this template with real data from your database and analytics.
> This document shows WHERE to find each metric.

---

## User Metrics

| Metric | Value | Source |
|--------|-------|--------|
| **Total Users** | `________` | `SELECT COUNT(*) FROM "User";` |
| **Active Users (last 7 days)** | `________` | `SELECT COUNT(DISTINCT "userId") FROM "UsageLog" WHERE "createdAt" >= NOW() - INTERVAL '7 days';` |
| **Active Users (last 30 days)** | `________` | Same as above with 30 days |
| **New Users (last 7 days)** | `________` | `SELECT COUNT(*) FROM "User" WHERE "createdAt" >= NOW() - INTERVAL '7 days';` |
| **New Users (last 30 days)** | `________` | Same as above with 30 days |
| **Daily Active Users (avg)** | `________` | `SELECT COUNT(DISTINCT "userId") FROM "UsageLog" WHERE "createdAt"::date = CURRENT_DATE;` (run daily for a week, average) |
| **Free Users** | `________` | `SELECT COUNT(*) FROM "User" WHERE "isPremium" = false;` |
| **Premium Users** | `________` | `SELECT COUNT(*) FROM "User" WHERE "isPremium" = true;` |
| **Users by Language** | `________` | `SELECT language, COUNT(*) FROM "UserSettings" GROUP BY language;` |
| **User Retention (Day 1/7/30)** | `________` | Cohort analysis — see `services/analytics/index.ts` `getRetentionStats()` |

---

## Subscription & Revenue Metrics

| Metric | Value | Source |
|--------|-------|--------|
| **Active Subscriptions** | `________` | `SELECT COUNT(*) FROM "Subscription" WHERE "status" = 'ACTIVE';` |
| **Subscriptions by Tier** | `________` | `SELECT "tier", COUNT(*) FROM "Subscription" WHERE "status" = 'ACTIVE' GROUP BY "tier";` |
| **Subscriptions by Plan Type** | `________` | `SELECT "planType", COUNT(*) FROM "Subscription" WHERE "status" = 'ACTIVE' GROUP BY "planType";` |
| **Monthly Recurring Revenue (MRR)** | `________` | Calculate: for each active subscription, its monthly price. Sum all. |
| **Total Revenue (all time)** | `________` | `SELECT SUM("amount") FROM "Payment" WHERE "status" = 'SUCCESS';` |
| **Revenue by Provider** | `________` | `SELECT "provider", SUM("amount") FROM "Payment" WHERE "status" = 'SUCCESS' GROUP BY "provider";` |
| **Pending Payments** | `________` | `SELECT COUNT(*) FROM "ManualPayment" WHERE "status" = 'PENDING';` |
| **Conversion Rate (Free → Premium)** | `________` | Premium users / Total users × 100 |
| **Churn Rate (monthly)** | `________` | Subscriptions expired this month / Active subscriptions at start of month × 100 |
| **Average Revenue Per User (ARPU)** | `________` | Total revenue / Total users |
| **Lifetime Value (LTV)** | `________` | ARPU × Average subscription duration (months) |

---

## AI Usage Metrics

| Metric | Value | Source |
|--------|-------|--------|
| **Total AI Requests (all time)** | `________` | `SELECT COUNT(*) FROM "UsageLog";` |
| **AI Requests (last 30 days)** | `________` | `SELECT COUNT(*) FROM "UsageLog" WHERE "createdAt" >= NOW() - INTERVAL '30 days';` |
| **Requests by Feature** | `________` | `SELECT feature, COUNT(*) FROM "UsageLog" GROUP BY feature ORDER BY COUNT(*) DESC;` |
| **Requests by Provider** | `________` | `SELECT provider, COUNT(*) FROM "UsageLog" GROUP BY provider ORDER BY COUNT(*) DESC;` |
| **Requests by Plan Type** | `________` | Plan type isn't in UsageLog directly. Join with User: `SELECT u."isPremium", COUNT(*) FROM "UsageLog" ul JOIN "User" u ON ul."userId" = u.id GROUP BY u."isPremium";` |
| **Average Response Time** | `________` | `SELECT AVG("durationMs") FROM "UsageLog";` (if duration is logged) |
| **Total Tokens Consumed** | `________` | `SELECT SUM("tokens") FROM "UsageLog";` (if tokens are logged) |
| **Average Tokens per Request** | `________` | `SELECT AVG("tokens") FROM "UsageLog";` |
| **Daily Average Requests** | `________` | Total requests / Days since first request |

---

## AI Cost Metrics

| Metric | Value | Source |
|--------|-------|--------|
| **Estimated AI Cost (last month)** | `________` | Calculate: For each request, model × tokens, look up pricing in `config/ai.ts` pricing table. |
| **Average Cost per Request** | `________` | Total AI cost / Total requests |
| **Cost by Provider** | `________` | Group by provider, sum costs (manual calculation using pricing table) |
| **Cost per User (avg)** | `________` | Total AI cost / Total users |

> **Note**: The cost-tracking feature uses usage data. Actual provider charges are available in each provider's dashboard (Google AI Studio, OpenAI Dashboard, etc.). The `UsageLog` tracks request counts but may not track per-request token counts accurately — cross-reference with provider dashboards.

---

## Vercel & Infrastructure Metrics

| Metric | Value | Source |
|--------|-------|--------|
| **Monthly Vercel Cost** | `________` | Vercel Dashboard → Usage → Billing |
| **Monthly Database Cost** | `________` | Database provider dashboard (Neon / Supabase / etc.) |
| **Monthly AI API Cost** | `________` | Respective AI provider dashboards |
| **Monthly Upstash Cost** | `________` | Upstash Console (if using Redis) |
| **Total Monthly Infrastructure Cost** | `________` | Sum of above |
| **Vercel Function Invocations (month)** | `________` | Vercel Dashboard → Usage → Serverless Function Execution |
| **Average Function Duration** | `________` | Vercel Dashboard → Usage → Serverless Function Duration |

---

## Engagement & Quality Metrics

| Metric | Value | Source |
|--------|-------|--------|
| **Sessions per User (avg)** | `________` | `SELECT AVG(session_count) FROM (SELECT "userId", COUNT(*) as session_count FROM "Conversation" GROUP BY "userId") sub;` |
| **Messages per Conversation (avg)** | `________` | `SELECT AVG(msg_count) FROM (SELECT "conversationId", COUNT(*) as msg_count FROM "Message" GROUP BY "conversationId") sub;` |
| **Most Used Feature** | `________` | See "Requests by Feature" above |
| **Least Used Feature** | `________` | See "Requests by Feature" above |
| **Top User Countries** | `________` | From Telegram user data (language selection, IP — not currently tracked explicitly) |
| **Bounce Rate (% users with 1 request)** | `________` | `SELECT COUNT(*) FROM (SELECT "userId", COUNT(*) as cnt FROM "UsageLog" GROUP BY "userId" HAVING COUNT(*) = 1) sub;` / Total users × 100 |

---

## Admin Dashboard Metrics (Already Available)

The admin dashboard at `/admin` displays these in real-time:

- **Overview**: Total users, new users, active users, premium users
- **Analytics**: Requests by feature, token usage, provider statistics
- **Growth**: User growth over time
- **Retention**: Returning user rate

To populate these, ensure `UsageLog` and `User` tables have data.

---

## How to Collect

1. **Connect to your database**: `npx prisma studio` opens a browser GUI
2. **Run SQL queries**: Use `psql` or Prisma Studio's query console
3. **Vercel dashboard**: https://vercel.com/your-project/dashboard
4. **AI provider dashboards**: Google AI Studio, OpenAI Dashboard, etc.
5. **Upstash console**: https://console.upstash.com/

---

*Fill in the `________` fields with real data before sharing this document with buyers or investors.*
