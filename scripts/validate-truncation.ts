/**
 * Validation script for the AI truncation fixes.
 * Tests: finish-reason detection, mid-sentence heuristic (+ feature gating),
 * continuation joining, splitMessage fence safety, and per-plan token caps.
 * Run: npm run test:truncation
 */
import { AIExecutor } from "../services/ai/core/executor";
import { splitMessage } from "../utils/markdown";
import { aiConfig } from "../config/ai";

// Private statics are reachable at runtime (compile-time private only)
const Exec = AIExecutor as unknown as {
  isTruncatedResponse: (r: { content: string; finishReason?: string }, maxTokens: number, feature?: string) => boolean;
  joinContinuation: (prev: string, next: string) => string;
};

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`);
}

const base = { model: "m", provider: "p" } as const;

// 1. finish_reason detection
check("finishReason=length -> truncated", Exec.isTruncatedResponse({ content: "abc", finishReason: "length", ...base }, 500), true);
check("finishReason=MAX_TOKENS -> truncated", Exec.isTruncatedResponse({ content: "abc", finishReason: "MAX_TOKENS", ...base }, 500), true);
check("finishReason=max_tokens -> truncated", Exec.isTruncatedResponse({ content: "abc", finishReason: "max_tokens", ...base }, 500), true);
check("finishReason=stop -> NOT truncated", Exec.isTruncatedResponse({ content: "abc", finishReason: "stop", ...base }, 500), false);

// 2. Mid-sentence heuristic (the exact reported example)
const example =
  "Отличная работа, что создали Telegram-бота! Это уже большой шаг. Теперь давайте разберем, что нужно сделать, чтобы его";
check("reported mid-sentence example -> truncated", Exec.isTruncatedResponse({ content: example, ...base }, 500), true);

check("complete sentence -> NOT truncated", Exec.isTruncatedResponse({ content: "Это полный ответ. Он закончен корректно.", ...base }, 500), false);
check("short complete 'Salom' -> NOT truncated", Exec.isTruncatedResponse({ content: "Salom", ...base }, 500), false);
check("ends with code fence -> NOT truncated", Exec.isTruncatedResponse({ content: "code:\n```js\nlet a = 1;\n```", ...base }, 500), false);
check("ends with emoji -> NOT truncated", Exec.isTruncatedResponse({ content: "Отлично! Это большой шаг 🚀", ...base }, 500), false);
check("near token limit -> truncated", Exec.isTruncatedResponse({ content: "x".repeat(2000), ...base }, 200), true);

// 2b. Feature gating: image/video prompts are not "sentences"
const longPrompt = "Фото реалистичного кота сидящего на диване в уютной гостиной с мягким теплым светом и книжным шкафом на заднем плане";
check("image prompt w/o punctuation -> NOT truncated (no false continuation)", Exec.isTruncatedResponse({ content: longPrompt, ...base }, 500, "image"), false);
check("video prompt w/o punctuation -> NOT truncated", Exec.isTruncatedResponse({ content: longPrompt, ...base }, 500, "video"), false);
check("same text as chat -> truncated (prose)", Exec.isTruncatedResponse({ content: longPrompt, ...base }, 500, "chat"), true);

// 3. Continuation joining
check("join mid-sentence with single space", Exec.joinContinuation("нужно сделать, чтобы его", "разобраться") === "нужно сделать, чтобы его разобраться", true);
check("join complete response with paragraph break", Exec.joinContinuation("Готово!", "Второй абзац.") === "Готово!\n\nВторой абзац.", true);
check("join with empty prev returns next", Exec.joinContinuation("", "текст") === "текст", true);
check("join trims leading whitespace of continuation", Exec.joinContinuation("Спасибо!", "\n\nПожалуйста.") === "Спасибо!\n\nПожалуйста.", true);

// 4. splitMessage: never break Telegram entities
const bigCode = "Параграф один.\n\nПараграф два с кодом:\n```python\n" + "x = 1\n".repeat(600) + "```\n\nКонец.";
const chunks = splitMessage(bigCode, 512);
check("splitMessage: every chunk <= 512 chars", chunks.every((c) => c.length <= 512), true);
const unbalanced = chunks.filter((c) => (c.match(/```/g) || []).length % 2 !== 0);
check("splitMessage: no chunk with unbalanced fence", unbalanced.length === 0, true);
const joined = chunks.join("");
check("splitMessage: no data loss (all 600 code lines present)", (joined.match(/x = 1/g) || []).length === 600, true);
check("splitMessage: paragraph boundary kept intact", chunks[0]!.includes("Параграф два с кодом:"), true);

// 5. Plan token caps (env overrides active)
process.env.FREE_MAX_TOKENS = "500";
process.env.PREMIUM_MAX_TOKENS = "1000";
check("FREE short prompt = 400 (base)", aiConfig.getMaxTokens("chat", "FREE", 50), 400);
check("FREE long prompt = 500 (env cap)", aiConfig.getMaxTokens("chat", "FREE", 5000), 500);
check("PREMIUM short prompt = 800 (base)", aiConfig.getMaxTokens("chat", "PREMIUM", 50), 800);
check("PREMIUM long prompt = 1000 (env cap)", aiConfig.getMaxTokens("chat", "PREMIUM", 5000), 1000);

// without env vars the tokenPolicies defaults apply (500 / 1000 caps)
delete process.env.FREE_MAX_TOKENS;
delete process.env.PREMIUM_MAX_TOKENS;
check("FREE (no env) long prompt = 500 (policy cap)", aiConfig.getMaxTokens("chat", "FREE", 5000), 500);
check("PREMIUM (no env) long prompt = 1000 (policy cap)", aiConfig.getMaxTokens("chat", "PREMIUM", 5000), 1000);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
