import type { HotSource } from "./types.js";

/** 公众号无公开热搜榜，第一期占位 */
export const weixinSource: HotSource = {
  id: "weixin",
  name: "公众号",
  implemented: false,
  fetch: async () => {
    throw new Error("公众号热搜尚未接入（无公开稳定热榜接口）");
  },
};
