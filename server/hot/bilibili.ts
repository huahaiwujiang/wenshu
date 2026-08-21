import { fetchZhiwei, httpGetJson, withCache, type HotSource, type HotTopic } from "./types.js";

/** B站热门 / 排行兜底知微 */
async function fetchBilibiliDirect(): Promise<HotTopic[]> {
  // 热门视频榜
  const data = await httpGetJson(
    "https://api.bilibili.com/x/web-interface/popular?ps=30&pn=1",
    { Referer: "https://www.bilibili.com/", Origin: "https://www.bilibili.com" },
  );
  const list = Array.isArray(data?.data?.list) ? data.data.list : [];
  const topics = list
    .map((item: any, i: number) => {
      const title = String(item?.title || "").trim();
      const bvid = item?.bvid ? String(item.bvid) : "";
      return {
        title,
        rank: i + 1,
        hot: item?.stat?.view ?? item?.rcmd_reason?.content,
        url: bvid ? `https://www.bilibili.com/video/${bvid}` : undefined,
      };
    })
    .filter((t: HotTopic) => t.title);

  if (topics.length) return topics;

  // 全站排行
  const rank = await httpGetJson(
    "https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all",
    { Referer: "https://www.bilibili.com/" },
  );
  const rankList = Array.isArray(rank?.data?.list) ? rank.data.list : [];
  return rankList
    .map((item: any, i: number) => {
      const title = String(item?.title || "").trim();
      const bvid = item?.bvid ? String(item.bvid) : "";
      return {
        title,
        rank: i + 1,
        hot: item?.stat?.view,
        url: bvid ? `https://www.bilibili.com/video/${bvid}` : undefined,
      };
    })
    .filter((t: HotTopic) => t.title)
    .slice(0, 30);
}

export const bilibiliSource: HotSource = {
  id: "bilibili",
  name: "B站",
  implemented: true,
  fetch: () =>
    withCache("bilibili", async () => {
      try {
        const list = await fetchBilibiliDirect();
        if (list.length) return list;
      } catch {
        /* fallthrough */
      }
      try {
        const list = await fetchZhiwei("bilibili");
        if (list.length) return list;
      } catch {
        /* fallthrough */
      }
      // 知微偶发 type 名不同
      const alt = await fetchZhiwei("bili");
      if (!alt.length) throw new Error("B站热榜暂不可用");
      return alt;
    }),
};
