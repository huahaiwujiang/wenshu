import { fetchZhiwei, withCache, type HotSource } from "./types.js";

/** 抖音官方接口本机常超时，走知微公开聚合兜底 */
export const douyinSource: HotSource = {
  id: "douyin",
  name: "抖音",
  implemented: true,
  fetch: () =>
    withCache("douyin", async () => {
      const list = await fetchZhiwei("douyin");
      if (!list.length) throw new Error("抖音热榜暂不可用");
      return list;
    }),
};
