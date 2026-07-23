/**
 * Centralized Callback Query Router
 *
 * Single source of truth for ALL callback query routing.
 * Replaces 50+ individual bot.callbackQuery() registrations with
 * a single handler and a route table.
 *
 * Order in register() determines priority. Register more specific
 * patterns BEFORE more general ones to avoid conflicts.
 *
 * Example:
 *   callbackRouter.register(/^history:delete:confirm:(.+)/, handler) // specific
 *   callbackRouter.register(/^history:delete:(.+)/, handler)         // general
 */

import type { BotContext } from "@/types";

export interface CallbackRoute {
  pattern: string | RegExp;
  handler: (ctx: BotContext) => Promise<void>;
}

export class CallbackRouter {
  private routes: CallbackRoute[] = [];

  /**
   * Register a callback route.
   * Routes are checked in registration order — first match wins.
   */
  register(pattern: string | RegExp, handler: (ctx: BotContext) => Promise<void>): this {
    this.routes.push({ pattern, handler });
    return this;
  }

  /**
   * Match callback data against the route table in order.
   * Returns true if a match was found and handler executed.
   */
  async match(ctx: BotContext): Promise<boolean> {
    const data = ctx.callbackQuery?.data;
    if (!data) return false;

    for (const route of this.routes) {
      let matched = false;

      if (typeof route.pattern === "string") {
        matched = data === route.pattern;
      } else {
        const result = data.match(route.pattern);
        if (result) {
          // Store match result as ctx.match for the handler
          (ctx as any).match = result;
          matched = true;
        }
      }

      if (matched) {
        await route.handler(ctx);
        return true;
      }
    }

    return false;
  }
}

/**
 * Global singleton callback router
 */
export const callbackRouter = new CallbackRouter();
