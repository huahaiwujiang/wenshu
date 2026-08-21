import { fetchZhiwei, httpGetJson, withCache, type HotSource, type HotTopic } from "./types.js";

async function fetchWeiboDirect(): Promise<HotTopic[]> {
  const data = await httpGetJson("https://weibo.com/ajax/side/hotSearch", {
    Referer: "https://weibo.com/",
  });
  const list = Array.isArray(data?.data?.realtime) ? data.data.realtime : [];
  return list
    .map((item: any, i: number) => {
      const title = String(item?.word || item?.word_scheme || "").trim();
      return {
        title,
        rank: i + 1,
        hot: item?.num,
        url: title ? `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}` : undefined,
      };
    })
    .filter((t: HotTopic) => t.title)
    .slice(0, 30);
}

export const weiboSource: HotSource = {
  id: "weibo",
  name: "微博",
  implemented: true,
  fetch: () =>
    withCache("weibo", async () => {
      try {
        const list = await fetchWeiboDirect();
        if (list.length) return list;
      } catch {
        /* fallthrough */
      }
      return fetchZhiwei("weibo");
    }),
};
