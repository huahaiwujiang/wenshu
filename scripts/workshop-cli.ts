/**
 * 文枢创意工坊 CLI — Agent / 终端双入口之一
 * 与 POST /api/generate 共用 runWorkshopGenerate，无需启动 Web 服务。
 *
 * 用法:
 *   npm run workshop -- --topic "AI 工具如何提效"
 *   npm run workshop -- --random-hot
 *   npm run workshop -- --topic "某话题" --platforms wechat,xiaohongshu --reference-urls "https://..."
 *   echo '{"topic":"..."}' | npm run workshop -- --json
 */

import { runWorkshopGenerate, type GenerateInput } from "../server/workshop.js";
import type { PlatformId } from "../server/content/ir.js";

const PLATFORMS = new Set<PlatformId>(["wechat", "xiaohongshu", "script", "markdown", "txt"]);

function usage(): string {
  return `文枢创意工坊 CLI

用法:
  npm run workshop -- [选项]
  npm run workshop -- "话题标题"          # positional 简写
  npx tsx scripts/workshop-cli.ts "话题"  # 同上

选项:
  --topic <text>              话题（留空且加 --random-hot 则从热搜抽取）
  --random-hot                先从已启用热搜源随机选题
  --reference-urls <urls>     参考链接，逗号/空格/换行分隔
  --reference-ratio <0-1>     借鉴比例，默认读 settings.json
  --platforms <list>          wechat,xiaohongshu,script,markdown,txt
  --template-id <id>          微信 HTML 模板 id
  --auto-search               无链接时自动检索（覆盖 settings）
  --no-auto-search            关闭自动检索
  --json                      从 stdin 读 JSON（字段同 GenerateInput）
  --help                      显示帮助

示例:
  npm run workshop -- --random-hot
  npm run workshop -- --topic "本地 AI 写作" --platforms wechat,xhs,script
`;
}

function parsePlatforms(raw?: string): PlatformId[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s === "xhs" ? "xiaohongshu" : s)) as PlatformId[];
  const bad = ids.filter((id) => !PLATFORMS.has(id));
  if (bad.length) throw new Error(`未知平台: ${bad.join(", ")}`);
  return ids;
}

function parseArgs(argv: string[]): GenerateInput & { randomHot?: boolean; jsonStdin?: boolean } {
  const out: GenerateInput & { randomHot?: boolean; jsonStdin?: boolean } = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("-")) {
      positional.push(a);
      continue;
    }
    switch (a) {
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      case "--topic":
        out.topic = argv[++i];
        break;
      case "--random-hot":
        out.randomHot = true;
        break;
      case "--reference-urls":
        out.referenceUrls = argv[++i];
        break;
      case "--reference-ratio":
        out.referenceRatio = Number(argv[++i]);
        break;
      case "--platforms":
        out.platforms = parsePlatforms(argv[++i]);
        break;
      case "--template-id":
        out.templateId = argv[++i];
        break;
      case "--auto-search":
        out.autoSearch = true;
        break;
      case "--no-auto-search":
        out.autoSearch = false;
        break;
      case "--json":
        out.jsonStdin = true;
        break;
      default:
        throw new Error(`未知参数: ${a}\n\n${usage()}`);
    }
  }

  if (positional.length && !out.topic) {
    out.topic = positional.join(" ");
  }
  return out;
}

async function readStdinJson(): Promise<Partial<GenerateInput>> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf-8").trim();
  if (!text) return {};
  return JSON.parse(text) as Partial<GenerateInput>;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  let input: GenerateInput = parsed;

  if (parsed.jsonStdin) {
    const fromStdin = await readStdinJson();
    input = { ...fromStdin, ...parsed };
  }
  delete (input as any).randomHot;
  delete (input as any).jsonStdin;

  if (parsed.randomHot && !input.topic?.trim()) {
    const { pickRandomHotTopic } = await import("../server/hot/index.js");
    const picked = await pickRandomHotTopic();
    input.topic = picked.topic;
    console.error(`[info] 热搜选题：[${picked.sourceName}] ${picked.topic}`);
  }

  const result = await runWorkshopGenerate(input, (level, message) => {
    console.error(`[${level}] ${message}`);
  });

  // stdout 仅 JSON，便于 Agent 解析
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((e: Error) => {
  console.error(`[error] ${e.message || String(e)}`);
  process.exit(1);
});
