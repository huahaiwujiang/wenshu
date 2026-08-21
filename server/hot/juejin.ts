import { httpGetJson, withCache, type HotSource, type HotTopic } from "./types.js";

async function fetchJuejinDirect(): Promise<HotTopic[]> {
  const data = await httpGetJson(
    "https://api.juejin.cn/content_api/v1/content/article_rank?category_id=1&type=hot",
  );
  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .map((item: any, i: number) => {
      const content = item?.content || {};
      const title = String(content?.title || "").trim();
      const id = content?.content_id;
      return {
        title,
        rank: i + 1,
        url: id ? `https://juejin.cn/post/${id}` : undefined,
      };
    })
    .filter((t: HotTopic) => t.title)
    .slice(0, 30);
}

export const juejinSource: HotSource = {
  id: "juejin",
  name: "掘金",
  implemented: true,
  fetch: () =>
    withCache("juejin", async () => {
      const list = await fetchJuejinDirect();
      if (!list.length) throw new Error("掘金热榜为空");
      return list;
    }),
};
