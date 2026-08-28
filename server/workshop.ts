import fs from "node:fs/promises";
import { resolveCover } from "./content/cover.js";
import { parseArticleIR, type ArticleIR, type PlatformId } from "./content/ir.js";
import { formatToPlatform, renderPlatform } from "./content/renderers.js";
import { fetchReferenceUrls, searchTopicSnippets, type ResearchSnippet } from "./content/research.js";
import { pickRandomHotTopic } from "./hot/index.js";
import { chatWithSettings } from "./llm.js";
import { readSettings, readTemplate, slugFromArticleIrPath, writeArticlePackage } from "./files.js";
import type { Settings } from "./paths.js";
import {
  buildResearchBlock,
  IR_SYSTEM_PROMPT,
  irUserPrompt,
  OUTLINE_SYSTEM_PROMPT,
  outlineUserPrompt,
} from "./workshop-prompts.js";

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
  /** Agent 已生成的 IR（对象或 JSON 字符串），跳过本地 LLM */
  ir?: ArticleIR | string;
  /** IR JSON 文件路径（CLI --ir-file） */
  irFile?: string;
  /** 强制走 data/settings.json 本地 LLM（网页入口同等；Agent 入口勿用） */
  localLlm?: boolean;
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

async function loadIrFromInput(
  input: GenerateInput,
  fallback: { topic: string; createdAt: string },
): Promise<ArticleIR> {
  let raw: string | ArticleIR | undefined = input.ir;
  if (input.irFile) {
    raw = await fs.readFile(input.irFile, "utf-8");
  }
  if (!raw) {
    throw new Error("Agent 模式需提供 IR：生成 JSON 后使用 --ir-file 或 stdin 中的 ir 字段");
  }
  if (typeof raw === "string") {
    return parseArticleIR(raw, fallback);
  }
  const ir = raw as ArticleIR;
  ir.schemaVersion = 1;
  ir.meta = {
    ...ir.meta,
    createdAt: ir.meta?.createdAt || fallback.createdAt,
    platforms: ir.meta?.platforms || [],
  };
  return ir;
}

/** 封面 → 多平台渲染 → 落盘（无需 LLM） */
export async function finalizeWorkshopPackage(
  ir: ArticleIR,
  input: Pick<GenerateInput, "templateId" | "platforms" | "irFile">,
  log: LogFn,
  meta: { topic: string; source?: { id: string; name: string } },
): Promise<GenerateResult> {
  const settings = await readSettings();

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

  const explicitPlatforms = Boolean(input.platforms?.length);
  const wanted = new Set<PlatformId>(
    (explicitPlatforms ? input.platforms! : settings.workshop.platforms) as PlatformId[],
  );
  if (!explicitPlatforms) {
    const fromFormat = formatToPlatform(settings.workshop.format);
    if (fromFormat) wanted.add(fromFormat);
    if (settings.workshop.format === "html") wanted.add("wechat");
  }

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

  const presetSlug = input.irFile ? slugFromArticleIrPath(input.irFile) : undefined;
  const saved = await writeArticlePackage(ir, variants, presetSlug ? { slug: presetSlug } : undefined);
  await log("info", `已保存 IR 包：${saved.irFile}`);

  return {
    topic: meta.topic,
    source: meta.source,
    title: ir.title,
    slug: saved.slug,
    irFile: saved.irFile,
    variants: saved.variants,
    platforms: variants.map((v) => v.platform),
    cover: ir.meta.coverPath || null,
  };
}

export async function runWorkshopGenerate(input: GenerateInput, log: LogFn): Promise<GenerateResult> {
  const settings = await readSettings();
  let topic = (input.topic || "").trim();
  let source: { id: string; name: string } | undefined;
  const createdAt = new Date().toISOString();

  // —— Agent 路径：已有 IR，只做渲染落盘 ——
  if (input.ir || input.irFile) {
    await log("info", "Agent 模式：跳过本地 LLM，渲染并落盘…");
    const ir = await loadIrFromInput(input, { topic: topic || "untitled", createdAt });
    topic = ir.topic || topic || ir.title;
    if (ir.meta.hotSource) source = ir.meta.hotSource;
    await log("info", `IR：${ir.title}（${ir.sections.length} 节）`);
    return finalizeWorkshopPackage(ir, input, log, { topic, source });
  }

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

  const researchBlock = buildResearchBlock(snippets, ratio);

  // 无 API Key 且未显式要求本地 LLM → 提示 Agent 自行写 IR
  const hasLlmKey = Boolean(settings.llm.api_key?.trim());
  if (!hasLlmKey && !input.localLlm) {
    throw new Error(
      "未配置 llm.api_key。Agent 入口请先用对话内模型生成 IR JSON 写入 output/article/{slug}.json，再执行：npx tsx scripts/workshop-cli.ts --ir-file output/article/{slug}.json --platforms …\n" +
        "（无需 API Key）。网页/终端全自动生成请加 --local-llm 并配置 data/settings.json。",
    );
  }

  await log("info", "第一阶段：生成提纲…");
  const outline = await chatWithSettings(settings, [
    { role: "system", content: OUTLINE_SYSTEM_PROMPT },
    { role: "user", content: outlineUserPrompt(topic, settings.workshop.minChars, settings.workshop.maxChars, researchBlock) },
  ]);
  await log("info", "提纲完成，开始生成结构化中间表示（IR）…");

  const irRaw = await chatWithSettings(
    settings,
    [
      { role: "system", content: IR_SYSTEM_PROMPT },
      {
        role: "user",
        content: irUserPrompt(
          topic,
          settings.workshop.minChars,
          settings.workshop.maxChars,
          ratio,
          outline,
          researchBlock,
        ),
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
  return finalizeWorkshopPackage(ir, input, log, { topic, source });
}

export type { Settings, ArticleIR };
