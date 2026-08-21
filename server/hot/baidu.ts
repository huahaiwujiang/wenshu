import { fetchZhiwei, httpGetJson, withCache, type HotSource, type HotTopic } from "./types.js";

function walkWords(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const v of node) walkWords(v, out);
    return;
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.word === "string" && o.word.trim()) out.push(o.word.trim());
    else if (typeof o.query === "string" && o.query.trim()) out.push(o.query.trim());
    for (const v of Object.values(o)) walkWords(v, out);
  }
}

async function fetchBaiduDirect(): Promise<HotTopic[]> {
  const data = await httpGetJson("https://top.baidu.com/api/board?platform=wise&tab=realtime");
  const words: string[] = [];
  walkWords(data, words);
  const uniq = [...new Set(words)];
  return uniq.slice(0, 30).map((title, i) => ({
    title,
    rank: i + 1,
    url: `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`,
  }));
}

export const baiduSource: HotSource = {
  id: "baidu",
  name: "百度",
  implemented: true,
  fetch: () =>
    withCache("baidu", async () => {
      try {
        const list = await fetchBaiduDirect();
        if (list.length) return list;
      } catch {
        /* fallthrough */
      }
      return fetchZhiwei("baidu");
    }),
};
