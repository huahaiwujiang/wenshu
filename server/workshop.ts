import { resolveCover } from "./content/cover.js";
import { parseArticleIR, type ArticleIR, type PlatformId } from "./content/ir.js";
import { formatToPlatform, renderPlatform } from "./content/renderers.js";
import { fetchReferenceUrls, searchTopicSnippets, type ResearchSnippet } from "./content/research.js";
import { pickRandomHotTopic } from "./hot/index.js";
import { chatWithSettings } from "./llm.js";
import { readSettings, readTemplate, writeArticlePackage } from "./files.js";
import type { Settings } from "./paths.js";

export type LogFn = (level: "info" | "warn" | "error", message: string) => void | Promise<void>;

export type GenerateInput = {
  topic?: string;
  templateId?: string;
  /** 参考链接，逗号或换行分隔 */
  referenceUrls?: string | string[];
  /** 覆盖设置中的借鉴比例 */
  referenceRatio?: number;
  /** 覆盖目标平台 */
  platforms?: PlatformId[];
  /** 是否自动检索（覆盖设置） */
  autoSearch?: boolean;
};

export type GenerateResult = {
  topic: string;
  source?: { id: string; name: string };
  title: string;
  slug: string;
  irFile: string;
  variants: string[];
  platforms: PlatformId[];
  cover?: string | null;
};

function normalizeUrls(input?: string | string[]): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join("\n") : input;
  return raw
    .split(/[\s,，\n]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

function buildResearchBlock(snippets: ResearchSnippet[], ratio: number): string {
  if (!snippets.length) return "（无外部参考，请基于常识与合理推断写作，并避免编造具体数据来源。）";
  const parts = snippets.map(
    (s, i) =>
      `### 参考${i + 1}：${s.title}\nURL: ${s.url}\n摘要：\n${s.excerpt.slice(0, 1800)}`,
  );
  return `借鉴比例约 ${Math.round(ratio * 100)}%（结构/观点可参考，表述需原创，禁止大段照抄）。\n\n${parts.join("\n\n")}`;
}

export async function runWorkshopGenerate(input: GenerateInput, log: LogFn): Promise<GenerateResult> {
  const settings = await readSettings();
  let topic = (input.topic || "").trim();
  let source: { id: string; name: string } | undefined;

  if (!topic) {
    await log("info", "话题为空，正在从已启用热搜源抽取…");
    const picked = await pickRandomHotTopic();
    topic = picked.topic;
    source = { id: picked.sourceId, name: picked.sourceName };
    await log("info", `选题来源：${picked.sourceName} → ${topic}`);
    if (picked.candidatesTried.length) {
      await log("warn", `部分源不可用：${picked.candidatesTried.join("；")}`);
    }
  } else {
    await log("info", `使用指定话题：${topic}`);
  }

  const ratio =
    typeof input.referenceRatio === "number"
      ? Math.min(1, Math.max(0, input.referenceRatio))
      : settings.workshop.referenceRatio;
  const autoSearch = input.autoSearch ?? settings.workshop.autoSearch;
  const urls = normalizeUrls(input.referenceUrls);

  await log("info", "素材阶段：抓取参考 / 检索…");
  let snippets: ResearchSnippet[] = [];
  if (urls.length) {
    snippets = await fetchReferenceUrls(urls);
    await log("info", `参考链接成功 ${snippets.length}/${urls.length}`);
  } else if (autoSearch) {
    snippets = await searchTopicSnippets(topic, 3);
    await log("info", snippets.length ? `自动检索到 ${snippets.length} 条摘要` : "自动检索无结果，将裸写");
  } else {
    await log("info", "已关闭自动检索，且无参考链接");
  }

  const createdAt = new Date().toISOString();
  await log("info", "第一阶段：生成提纲…");
  const outline = await chatWithSettings(settings, [
    {
      role: "system",
      content:
        "你是中文内容主编。根据话题与参考素材写出简洁提纲：标题建议 + 3～6 个小节要点 + 开头钩子/结尾行动号召各一句。只输出提纲，不要正文。",
    },
    {
      role: "user",
      content: `话题：${topic}\n目标字数约 ${settings.workshop.minChars}～${settings.workshop.maxChars} 字。\n\n参考素材：\n${buildResearchBlock(snippets, ratio)}`,
    },
  ]);
  await log("info", "提纲完成，开始生成结构化中间表示（IR）…");

  const irRaw = await chatWithSettings(
    settings,
    [
      {
        role: "system",
        content: `你是中文写作引擎。只输出一个 JSON 对象（不要 Markdown 围栏），结构如下：
{
  "title": "文章标题",
  "topic": "原话题",
  "digest": "不超过54字的摘要",
  "tags": ["标签1","标签2"],
  "hooks": { "opening": "开头钩子", "closing": "结尾" },
  "sections": [{ "heading": "小节标题", "paragraphs": ["段落1","段落2"] }],
  "xhsBeats": ["小红书短句1","短句2", "..."],
  "scriptBeats": ["口播镜头1","镜头2", "..."],
  "sources": [{ "title":"", "url":"", "excerpt":"" }]
}
要求：口语自然、有观点、少套话；按借鉴比例消化参考；字数约在目标区间；sections 至少 3 个。`,
      },
      {
        role: "user",
        content: `话题：${topic}\n字数：${settings.workshop.minChars}～${settings.workshop.maxChars}\n借鉴比例：${ratio}\n\n提纲：\n${outline}\n\n参考素材：\n${buildResearchBlock(snippets, ratio)}`,
      },
    ],
    { temperature: 0.75 },
  );

  const ir = parseArticleIR(irRaw, { topic, createdAt });
  ir.sources =
    snippets.map((s) => ({ title: s.title, url: s.url, excerpt: s.excerpt.slice(0, 240) })) || ir.sources;
  ir.meta.referenceRatio = ratio;
  if (source) ir.meta.hotSource = source;

  await log("info", `IR 完成：${ir.title}（${ir.sections.length} 节）`);

  // 封面
  const cover = await resolveCover(ir, settings.workshop.coverMode);
  if (cover?.filePath) {
    ir.meta.coverPath = cover.filePath;
    await log("info", `封面：本地 ${cover.filePath}`);
  } else if (cover?.url) {
    ir.meta.coverPath = cover.url;
    await log("info", `封面：Picsum`);
  } else {
    await log("warn", "未解析到封面，发布时将用占位图");
  }

  // 平台集合：设置 platforms + format 映射
  const wanted = new Set<PlatformId>(
    (input.platforms?.length ? input.platforms : settings.workshop.platforms) as PlatformId[],
  );
  const fromFormat = formatToPlatform(settings.workshop.format);
  if (fromFormat) wanted.add(fromFormat);
  if (settings.workshop.format === "html") wanted.add("wechat");

  let templateHtml: string | undefined;
  const tplId = input.templateId || settings.workshop.defaultTemplate;
  if (settings.workshop.useTemplate && tplId && wanted.has("wechat")) {
    try {
      templateHtml = (await readTemplate(tplId)).content;
      await log("info", `微信模板：${tplId}`);
    } catch {
      await log("warn", `模板 ${tplId} 不可用，改用内置微信排版`);
    }
  }

  const variants: Array<{ platform: PlatformId; filename: string; content: string }> = [];
  for (const platform of wanted) {
    const rendered = renderPlatform(platform, ir, { templateHtml });
    variants.push({
      platform,
      filename: `${rendered.filenameSuffix}.${rendered.ext}`,
      content: rendered.content,
    });
    await log("info", `已渲染：${platform} → *.${rendered.filenameSuffix}.${rendered.ext}`);
  }

  const saved = await writeArticlePackage(ir, variants);
  await log("info", `已保存 IR 包：${saved.irFile}`);

  return {
    topic,
    source,
    title: ir.title,
    slug: saved.slug,
    irFile: saved.irFile,
    variants: saved.variants,
    platforms: variants.map((v) => v.platform),
    cover: ir.meta.coverPath || null,
  };
}

export type { Settings, ArticleIR };
