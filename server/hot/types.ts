export type HotTopic = {
  title: string;
  rank?: number;
  hot?: string | number;
  url?: string;
};

export type HotSource = {
  id: string;
  name: string;
  /** 是否已实现抓取；占位源返回空并标记 unavailable */
  implemented: boolean;
  fetch: () => Promise<HotTopic[]>;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function httpGetJson(url: string, headers: Record<string, string> = {}, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 知微公开聚合（直连失败时的兜底，不依赖原仓代码） */
export async function fetchZhiwei(type: string): Promise<HotTopic[]> {
  const url = `https://trends.zhiweidata.com/hotSearchTrend/search/longTimeInListSearch?type=${encodeURIComponent(type)}&sortType=realTime`;
  const data = await httpGetJson(url, { Referer: "https://trends.zhiweidata.com/" });
  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .map((item: any, i: number) => ({
      title: String(item?.name || "").trim(),
      rank: Number(item?.rank ?? i + 1),
      hot: item?.lastCount,
      url: item?.url || undefined,
    }))
    .filter((t: HotTopic) => t.title);
}

type CacheEntry = { at: number; topics: HotTopic[] };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000;

export async function withCache(id: string, loader: () => Promise<HotTopic[]>): Promise<HotTopic[]> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.topics;
  }
  const topics = await loader();
  if (topics.length) {
    cache.set(id, { at: Date.now(), topics });
  }
  return topics;
}
