import { fetchZhiwei, withCache, type HotSource } from "./types.js";

/** 小红书官网为 SPA，无稳定热榜 JSON；走知微 little-red-book */
export const xiaohongshuSource: HotSource = {
  id: "xiaohongshu",
  name: "小红书",
  implemented: true,
  fetch: () =>
    withCache("xiaohongshu", async () => {
      const list = await fetchZhiwei("little-red-book");
      if (!list.length) throw new Error("小红书热榜暂不可用");
      return list;
    }),
};
