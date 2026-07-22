import OpenAI from "openai";
import { env } from "@/config";

/**
 * OpenAI-compatible API client
 * Can be used with any OpenAI-compatible provider
 */
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
  maxRetries: 3,
  timeout: 60000,
});

export default openai;
