export type ApiResult<T> = { status: string; data?: T; message?: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const json = (await res.json()) as ApiResult<T>;
  if (!res.ok || json.status === "error") {
    throw new Error(json.message || `请求失败 ${res.status}`);
  }
  return json.data as T;
}

export const api = {
  getSettings: () => request<any>("/api/settings"),
  saveSettings: (body: unknown) =>
    request<any>("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
  listPlatforms: () => request<any[]>("/api/platforms"),
  listHotSources: () => request<any[]>("/api/hot/sources"),
  fetchHot: (id: string) => request<any[]>(`/api/hot/${id}`),
  randomHot: () =>
    request<{ topic: string; sourceName: string; sourceId: string }>("/api/hot/random", {
      method: "POST",
      body: "{}",
    }),
  listArticles: () => request<any[]>("/api/articles"),
  getArticle: (name: string) => request<{ name: string; content: string }>(`/api/articles/${encodeURIComponent(name)}`),
  saveArticle: (name: string, content: string) =>
    request<{ name: string }>(`/api/articles/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  rerenderArticle: (name: string, content: string) =>
    request<any>(`/api/articles/${encodeURIComponent(name)}/rerender`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  deleteArticle: (name: string) =>
    request<void>(`/api/articles/${encodeURIComponent(name)}`, { method: "DELETE" }),
  listTemplates: () => request<any[]>("/api/templates"),
  getTemplate: (id: string) => request<{ id: string; name: string; content: string }>(`/api/templates/${encodeURIComponent(id)}`),
  saveTemplate: (id: string, content: string) =>
    request<{ name: string }>(`/api/templates/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  deleteTemplate: (id: string) =>
    request<void>(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listPublishers: () => request<any[]>("/api/publishers"),
  async publish(platform: string, article: string) {
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, article }),
    });
    const json = (await res.json()) as ApiResult<any>;
    if (json.data) return json.data;
    throw new Error(json.message || `发布失败 ${res.status}`);
  },
};

export type GenLog = { level: string; message: string; at?: string };

export async function generateWithSSE(
  payload: {
    topic?: string;
    templateId?: string;
    referenceUrls?: string;
    referenceRatio?: number;
    platforms?: string[];
    autoSearch?: boolean;
  },
  onLog: (log: GenLog) => void,
): Promise<any> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    throw new Error(`生成请求失败 HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: any = null;
  let errorMsg: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const chunk of parts) {
      const lines = chunk.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        if (event === "log") onLog(parsed);
        else if (event === "done") donePayload = parsed;
        else if (event === "error") errorMsg = parsed.message || "生成失败";
      } catch {
        /* ignore */
      }
    }
  }
  if (errorMsg) throw new Error(errorMsg);
  if (!donePayload) throw new Error("生成未返回结果");
  return donePayload;
}
