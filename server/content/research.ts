export type ResearchSnippet = {
  url: string;
  title: string;
  excerpt: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return og[1].trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? stripHtml(t[1]).slice(0, 120) : "";
}

/** 抓取参考链接正文摘要，供借鉴写作 */
export async function fetchReferenceUrls(urls: string[], maxCharsPerPage = 2800): Promise<ResearchSnippet[]> {
  const cleaned = [...new Set(urls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)))].slice(0, 5);
  const out: ResearchSnippet[] = [];

  await Promise.all(
    cleaned.map(async (url) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
          signal: ctrl.signal,
          redirect: "follow",
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const title = extractTitle(html) || url;
        const excerpt = stripHtml(html).slice(0, maxCharsPerPage);
        if (excerpt.length > 80) {
          out.push({ url, title, excerpt });
        }
      } catch {
        /* 单链失败不阻断 */
      }
    }),
  );

  return out;
}

/** 轻量话题检索：用百度搜索页抽摘要（无独立搜索 API 时的兜底） */
export async function searchTopicSnippets(topic: string, limit = 3): Promise<ResearchSnippet[]> {
  const q = topic.trim();
  if (!q) return [];
  try {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(q)}&rn=10`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://www.baidu.com/" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    const blocks = [...html.matchAll(/<div class="c-container"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="c-container"|<div id="page")/gi)];
    const snippets: ResearchSnippet[] = [];
    for (const m of blocks) {
      const block = m[1] || "";
      const title = stripHtml((block.match(/<h3[\s\S]*?<a[\s\S]*?>([\s\S]*?)<\/a>/i) || [])[1] || "").slice(0, 80);
      const href = (block.match(/<h3[\s\S]*?<a[^>]+href="([^"]+)"/i) || [])[1] || "";
      const excerpt = stripHtml(block).slice(0, 400);
      if (title && excerpt.length > 40) {
        snippets.push({ url: href || url, title, excerpt });
      }
      if (snippets.length >= limit) break;
    }
    return snippets;
  } catch {
    return [];
  }
}
