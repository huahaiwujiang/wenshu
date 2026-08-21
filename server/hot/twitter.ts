import type { HotSource } from "./types.js";

/** Twitter/X 官方 API 需付费，第一期占位 */
export const twitterSource: HotSource = {
  id: "twitter",
  name: "推特",
  implemented: false,
  fetch: async () => {
    throw new Error("推特热搜尚未接入（需官方付费 API）");
  },
};
