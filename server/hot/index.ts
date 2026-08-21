import { baiduSource } from "./baidu.js";
import { bilibiliSource } from "./bilibili.js";
import { douyinSource } from "./douyin.js";
import { juejinSource } from "./juejin.js";
import { toutiaoSource } from "./toutiao.js";
import { twitterSource } from "./twitter.js";
import { weiboSource } from "./weibo.js";
import { weixinSource } from "./weixin.js";
import { xiaohongshuSource } from "./xiaohongshu.js";
import type { HotSource, HotTopic } from "./types.js";
import { readSettings } from "../files.js";

export const HOT_SOURCES: HotSource[] = [
  baiduSource,
  toutiaoSource,
  weiboSource,
  juejinSource,
  douyinSource,
  xiaohongshuSource,
  bilibiliSource,
  weixinSource,
  twitterSource,
];

const byId = new Map(HOT_SOURCES.map((s) => [s.id, s]));

export function listHotSourceMeta() {
  return HOT_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    implemented: s.implemented,
  }));
}

export async function fetchSourceTopics(sourceId: string): Promise<HotTopic[]> {
  const src = byId.get(sourceId);
  if (!src) throw new Error(`未知热搜源：${sourceId}`);
  return src.fetch();
}

export type RandomHotResult = {
  sourceId: string;
  sourceName: string;
  topic: string;
  candidatesTried: string[];
};

/** 从已启用且本次成功的源中，按排名加权随机一条 */
export async function pickRandomHotTopic(): Promise<RandomHotResult> {
  const settings = await readSettings();
  const enabled = HOT_SOURCES.filter((s) => (settings.hotSources as Record<string, boolean>)[s.id]);
  if (!enabled.length) {
    throw new Error("没有启用的热搜源，请在设置中打开至少一个源，或手动填写话题");
  }

  const tried: string[] = [];
  const bags: Array<{ source: HotSource; topics: HotTopic[] }> = [];

  await Promise.all(
    enabled.map(async (source) => {
      try {
        const topics = await source.fetch();
        if (topics.length) {
          bags.push({ source, topics });
        } else {
          tried.push(`${source.name}:空`);
        }
      } catch (e: any) {
        tried.push(`${source.name}:${e?.message || "失败"}`);
      }
    }),
  );

  if (!bags.length) {
    throw new Error(
      `所有已启用热搜源均失败，请手填话题。详情：${tried.join("；") || "无"}`,
    );
  }

  const bag = bags[Math.floor(Math.random() * bags.length)];
  const topics = bag.topics;
  const weights = topics.map((_, i) => 1 / (i + 1) ** 2);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  let idx = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      idx = i;
      break;
    }
  }
  const topic = topics[idx].title.replace(/\|/g, "——");
  return {
    sourceId: bag.source.id,
    sourceName: bag.source.name,
    topic,
    candidatesTried: tried,
  };
}
