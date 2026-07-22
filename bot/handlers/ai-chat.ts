import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { aiChatService } from "@/services/ai/chat";
import { chatKeyboard, backToMainKeyboard } from "@/bot/keyboards";
import { splitMessage } from "@/utils/markdown";
import { prisma } from "@/lib/prisma";

/**
 * AI Chat handler
 * Provides ChatGPT-like conversation experience with memory
 */
export async function aiChatHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  // Ensure user exists in DB (userMiddleware should have already created them)
  const userId = ctx.session.userId;
  if (!userId) {
    await ctx.reply(
      "❌ *Error*\n\nCould not identify your account. Please use /start first.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Create conversation if not exists
  if (!ctx.session.conversationId) {
    const conversation = await prisma.conversation.create({
      data: {
        title: text.slice(0, 100),
        feature: "chat",
        userId,
      },
    });
    ctx.session.conversationId = conversation.id;
  }

  // Show typing indicator
  await ctx.replyWithChatAction("typing");

  try {
    // Get AI response
    const response = await aiChatService.chat(ctx.session.messages, text);

    // Store user message in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({
      role: "assistant",
      content: response.content,
    });

    // Save to database
    await prisma.message.createMany({
      data: [
        {
          conversationId: ctx.session.conversationId!,
          userId,
          role: "user",
          content: text,
        },
        {
          conversationId: ctx.session.conversationId!,
          userId,
          role: "assistant",
          content: response.content,
          tokensUsed: response.usage?.totalTokens ?? 0,
        },
      ],
    });

    // Track usage
    await prisma.usage.create({
      data: {
        userId,
        feature: "chat",
        tokensIn: response.usage?.promptTokens ?? 0,
        tokensOut: response.usage?.completionTokens ?? 0,
      },
    });

    // Update user request count
    await prisma.user.update({
      where: { id: userId },
      data: {
        requestsToday: { increment: 1 },
        totalRequests: { increment: 1 },
      },
    });

    // Split and send long responses
    const chunks = splitMessage(response.content);
    for (const chunk of chunks) {
      await ctx.reply(chunk, {
        parse_mode: "Markdown",
        reply_markup: chunks.indexOf(chunk) === chunks.length - 1 ? chatKeyboard : undefined,
      });
    }
  } catch (error) {
    console.error("AI Chat error:", error);
    await ctx.reply(
      "❌ *Error*\n\nSorry, I encountered an error. Please try again.\n\n" +
        "Make sure your OpenAI API key is configured correctly.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

/**
 * Start a new chat conversation
 */
export async function newChatHandler(ctx: BotContext): Promise<void> {
  ctx.session.conversationId = null;
  ctx.session.messages = [];

  await ctx.reply(
    "🔄 *New Chat Started*\n\n" +
      "I've cleared our conversation history.\n" +
      "Send me a message to start fresh! 💬",
    {
      parse_mode: "Markdown",
      reply_markup: chatKeyboard,
    }
  );
}

/**
 * Show chat history
 */
export async function chatHistoryHandler(ctx: BotContext): Promise<void> {
  const userId = ctx.session.userId;
  if (!userId) {
    await ctx.reply(
      "❌ *Error*\n\nCould not identify your account.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      feature: "chat",
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      _count: { select: { messages: true } },
    },
  });

  if (conversations.length === 0) {
    await ctx.reply(
      "📋 *No conversations yet*\n\nStart chatting and your history will appear here!",
      { parse_mode: "Markdown", reply_markup: chatKeyboard }
    );
    return;
  }

  const historyText = conversations
    .map(
      (
        conv: { title: string; _count: { messages: number }; updatedAt: Date },
        i: number
      ) =>
        `${i + 1}. ${conv.title}\n` +
        `   💬 ${conv._count.messages} messages\n` +
        `   🕐 ${conv.updatedAt.toLocaleDateString()}`
    )
    .join("\n\n");

  await ctx.reply(`📋 *Chat History*\n\n${historyText}`, {
    parse_mode: "Markdown",
    reply_markup: chatKeyboard,
  });
}
