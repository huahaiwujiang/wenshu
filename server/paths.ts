import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 项目根目录（wenshu/） */
export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
/** 成稿与配图目录（文枢自用；内容从原仓 output 复制而来，不改动原仓） */
export const OUTPUT_DIR = path.join(ROOT, "output");
export const ARTICLES_DIR = path.join(OUTPUT_DIR, "article");
export const WECHAT_IMAGES_DIR = path.join(OUTPUT_DIR, "wechat-images");
export const TEMPLATES_DIR = path.join(DATA_DIR, "templates");
export const NOVELS_DIR = path.join(DATA_DIR, "novels");
export const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
export const PUBLISH_RECORDS_PATH = path.join(DATA_DIR, "publish-records.json");
export const WEB_DIST = path.join(ROOT, "web", "dist");

export const DEFAULT_SETTINGS = {
  llm: {
    base_url: "https://api.deepseek.com/v1",
    api_key: "",
    model: "deepseek-chat",
  },
  wechat: {
    appid: "",
    appsecret: "",
    author: "",
  },
  workshop: {
    minChars: 800,
    maxChars: 2000,
    /** 额外 raw 落盘：html 由 wechat 渲染承担；markdown/txt 另存 */
    format: "html" as "html" | "markdown" | "txt",
    useTemplate: true,
    defaultTemplate: "simple-card",
    /** 方向 D：一稿多平台 */
    platforms: ["wechat", "xiaohongshu", "script"] as Array<
      "wechat" | "xiaohongshu" | "script" | "markdown" | "txt"
    >,
    /** 借鉴比例 0~1，仅在有参考链接/检索时生效 */
    referenceRatio: 0.35,
    /** 无参考链接时是否自动检索话题 */
    autoSearch: true,
    coverMode: "local" as "local" | "picsum" | "none",
  },
  hotSources: {
    baidu: true,
    toutiao: true,
    weibo: true,
    juejin: true,
    douyin: true,
    xiaohongshu: true,
    bilibili: true,
    weixin: false,
    twitter: false,
  },
  /** Agent / CLI 双入口偏好（网页入口不受影响） */
  agent: {
    /** 为 true 时，协作 Agent 应走创意工坊而非对话内直接写稿 */
    requireWorkshopFlow: true,
    /** HTTP API 基址（Web 服务启动后） */
    apiBase: "http://127.0.0.1:8787",
    /** 默认入口：cli 无需启动 Web；api 需 npm run dev / npm start */
    preferredEntry: "cli" as "cli" | "api",
  },
};

export type Settings = typeof DEFAULT_SETTINGS;
