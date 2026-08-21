import type { Settings } from "./paths.js";
import { readSettings } from "./files.js";

export async function chatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: { temperature?: number },
): Promise<string> {
  const settings = await readSettings();
  return chatWithSettings(settings, messages, options);
}

export async function chatWithSettings(
  settings: Settings,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: { temperature?: number },
): Promise<string> {
  const { base_url, api_key, model } = settings.llm;
  if (!api_key?.trim()) {
    throw new Error("请先在系统设置中填写 LLM API Key");
  }
  if (!base_url?.trim()) {
    throw new Error("请先在系统设置中填写 LLM base_url");
  }
  if (!model?.trim()) {
    throw new Error("请先在系统设置中填写模型名称");
  }

  const endpoint = `${base_url.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api_key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`LLM 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 300);
    throw new Error(`LLM 请求失败（HTTP ${res.status}）：${msg}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM 未返回有效正文");
  }
  return content.trim();
}
