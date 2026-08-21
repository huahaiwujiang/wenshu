import { fetchZhiwei, httpGetJson, withCache, type HotSource, type HotTopic } from "./types.js";

async function fetchToutiaoDirect(): Promise<HotTopic[]> {
  const data = await httpGetJson("https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc");
  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .map((item: any, i: number) => ({
      title: String(item?.Title || item?.title || "").trim(),
      rank: i + 1,
      url: item?.Url || item?.url || undefined,
    }))
    .filter((t: HotTopic) => t.title)
    .slice(0, 30);
}

export const toutiaoSource: HotSource = {
  id: "toutiao",
  name: "头条",
  implemented: true,
  fetch: () =>
    withCache("toutiao", async () => {
      try {
        const list = await fetchToutiaoDirect();
        if (list.length) return list;
      } catch {
        /* fallthrough */
      }
      return fetchZhiwei("toutiao");
    }),
};
