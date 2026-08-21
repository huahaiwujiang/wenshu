/** 结构化中间表示：一稿多平台的唯一真源 */

export type ArticleSection = {
  heading: string;
  paragraphs: string[];
};

export type ArticleSource = {
  title?: string;
  url?: string;
  excerpt?: string;
};

export type PlatformId = "wechat" | "xiaohongshu" | "script" | "markdown" | "txt";

export type ArticleIR = {
  schemaVersion: 1;
  title: string;
  topic: string;
  digest: string;
  tags: string[];
  hooks: {
    opening: string;
    closing: string;
  };
  sections: ArticleSection[];
  /** 小红书向短句（可为空，渲染器可从 sections 推导） */
  xhsBeats?: string[];
  /** 口播分镜提示（可为空） */
  scriptBeats?: string[];
  sources: ArticleSource[];
  meta: {
    createdAt: string;
    updatedAt?: string;
    referenceRatio?: number;
    coverPath?: string | null;
    platforms: PlatformId[];
    hotSource?: { id: string; name: string };
  };
};

export const PLATFORM_META: Record<
  PlatformId,
  { id: PlatformId; name: string; ext: string; description: string }
> = {
  wechat: { id: "wechat", name: "微信公众号", ext: "html", description: "长文 HTML，套模板/内联样式" },
  xiaohongshu: { id: "xiaohongshu", name: "小红书", ext: "txt", description: "短结构 + emoji 节奏 + 话题标签" },
  script: { id: "script", name: "口播稿", ext: "txt", description: "短视频口播 + 分镜提示" },
  markdown: { id: "markdown", name: "Markdown", ext: "md", description: "通用 Markdown" },
  txt: { id: "txt", name: "纯文本", ext: "txt", description: "无样式纯文本" },
};

export function stripFence(text: string): string {
  return text
    .replace(/^```(?:json|markdown|md|html|txt)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseArticleIR(raw: string, fallback: { topic: string; createdAt: string }): ArticleIR {
  const text = stripFence(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(text.slice(start, end + 1));
    } else {
      throw new Error("模型未返回合法 JSON 中间表示");
    }
  }

  const sections: ArticleSection[] = Array.isArray(parsed.sections)
    ? parsed.sections
        .map((s: any) => ({
          heading: String(s?.heading || "").trim(),
          paragraphs: Array.isArray(s?.paragraphs)
            ? s.paragraphs.map((p: any) => String(p || "").trim()).filter(Boolean)
            : String(s?.body || s?.content || "")
                .split(/\n+/)
                .map((p: string) => p.trim())
                .filter(Boolean),
        }))
        .filter((s: ArticleSection) => s.heading || s.paragraphs.length)
    : [];

  if (!sections.length) {
    throw new Error("中间表示缺少 sections");
  }

  const title = String(parsed.title || fallback.topic).trim() || fallback.topic;
  const digest = String(parsed.digest || "").trim() || sections[0]?.paragraphs[0]?.slice(0, 54) || title.slice(0, 54);

  return {
    schemaVersion: 1,
    title,
    topic: String(parsed.topic || fallback.topic).trim() || fallback.topic,
    digest: digest.slice(0, 120),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    hooks: {
      opening: String(parsed.hooks?.opening || parsed.opening || "").trim(),
      closing: String(parsed.hooks?.closing || parsed.closing || "").trim(),
    },
    sections,
    xhsBeats: Array.isArray(parsed.xhsBeats)
      ? parsed.xhsBeats.map((x: any) => String(x).trim()).filter(Boolean)
      : undefined,
    scriptBeats: Array.isArray(parsed.scriptBeats)
      ? parsed.scriptBeats.map((x: any) => String(x).trim()).filter(Boolean)
      : undefined,
    sources: Array.isArray(parsed.sources)
      ? parsed.sources.map((s: any) => ({
          title: s?.title ? String(s.title) : undefined,
          url: s?.url ? String(s.url) : undefined,
          excerpt: s?.excerpt ? String(s.excerpt).slice(0, 500) : undefined,
        }))
      : [],
    meta: {
      createdAt: fallback.createdAt,
      referenceRatio: typeof parsed.meta?.referenceRatio === "number" ? parsed.meta.referenceRatio : undefined,
      coverPath: null,
      platforms: [],
    },
  };
}

export function plainBodyFromIR(ir: ArticleIR): string {
  const parts: string[] = [];
  if (ir.hooks.opening) parts.push(ir.hooks.opening);
  for (const sec of ir.sections) {
    if (sec.heading) parts.push(sec.heading);
    parts.push(...sec.paragraphs);
  }
  if (ir.hooks.closing) parts.push(ir.hooks.closing);
  return parts.join("\n\n");
}
