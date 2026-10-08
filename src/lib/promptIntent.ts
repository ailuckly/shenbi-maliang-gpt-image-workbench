// Decides whether a composer message is an image request or small talk ("你好", "谢谢", "你是谁").
// The rule layer is shared by the client (直出, no network) and the server (智能, before asking a
// small model about the unclear cases). It must never block a real image request, so anything
// that mentions visual content, is long, or comes with images counts as an image request.

import { PROMPT_LEAK_REPLY, isPromptLeakAttempt } from "./promptInjection";

export type PromptIntent = "image" | "chat";
export type PromptIntentRuleResult = PromptIntent | "unsure";

const GREETING = /^(你好|您好|嗨|哈喽|哈啰|hello|hi|hey|在吗|在不在|早上好|上午好|中午好|下午好|晚上好|晚安|早安|good (morning|afternoon|evening)|yo)$/i;
const THANKS = /^(谢谢|多谢|感谢|谢了|thx|thanks|thank you|ok|okay|好的|好|嗯|嗯嗯|收到|明白|了解|行|可以|不错|很好|棒|厉害|哈哈+|呵呵|拜拜|再见|bye)$/i;
const ABOUT_ASSISTANT = /^(你是谁|你叫什么|你能做什么|你会什么|你可以做什么|怎么用|如何使用|帮助|help|who are you|what can you do)$/i;

const VISUAL_HINT = new RegExp(
  [
    "画", "绘", "图", "照", "像", "生成", "做一张", "来一张", "设计", "海报", "插画", "头像", "壁纸", "封面", "logo", "标志",
    "风格", "场景", "背景", "镜头", "构图", "光线", "色调", "写实", "卡通", "动漫", "水彩", "油画", "素描", "渲染", "3d",
    "人物", "女孩", "男孩", "猫", "狗", "风景", "城市", "产品", "包装", "字体", "排版",
    "draw", "paint", "image", "picture", "photo", "illustration", "poster", "render", "portrait", "style", "scene", "logo",
    "改成", "换成", "去掉", "加上", "调整", "修改", "变成", "保留", "放大", "替换"
  ].join("|"),
  "i"
);

function normalize(text: string) {
  return text.trim().replace(/[\s!！。.,，~～?？、…]+$/g, "").replace(/^[\s,，]+/, "").trim();
}

export function classifyPromptIntentByRule(text: string, options: { hasImages?: boolean } = {}): PromptIntentRuleResult {
  // Requests for the hidden instructions get a refusal instead of an image, even with images attached.
  if (isPromptLeakAttempt(text)) return "chat";
  if (options.hasImages) return "image";
  const value = normalize(text);
  if (!value) return "chat";
  if (GREETING.test(value) || THANKS.test(value) || ABOUT_ASSISTANT.test(value)) return "chat";
  if (VISUAL_HINT.test(value)) return "image";
  // Long descriptions are almost always prompts, even without a keyword.
  if (value.length > 30) return "image";
  // A short subject like "一只柴犬" or "sunset beach" is a prompt; short questions are not clear.
  if (/[?？吗呢么]$|^(为什么|怎么|如何|什么|是不是|能不能|可不可以|what|why|how|can you|do you)/i.test(text.trim())) return "unsure";
  return value.length <= 3 ? "unsure" : "image";
}

export const PROMPT_INTENT_DEFAULT_REPLY =
  "这里是图像工作台，我会把你的描述画成图片。试着告诉我想要的画面，比如「一只在窗边晒太阳的橘猫，柔和的午后光线」。";

/** Canned reply for small talk the rules recognised. */
export function ruleChatReply(text: string) {
  if (isPromptLeakAttempt(text)) return PROMPT_LEAK_REPLY;
  const value = normalize(text);
  if (GREETING.test(value)) return `你好！${PROMPT_INTENT_DEFAULT_REPLY}`;
  if (THANKS.test(value)) return "不客气！想再画点什么，直接描述画面就好。";
  return PROMPT_INTENT_DEFAULT_REPLY;
}
