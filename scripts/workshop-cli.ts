/**
 * 文枢创意工坊 CLI
 *
 * Agent 入口（无需 llm.api_key）：
 *   1. Agent 写 IR → output/article/{slug}.json（唯一真源）
 *   2. npx tsx scripts/workshop-cli.ts --ir-file output/article/{slug}.json --platforms wechat
 *
 * 网页同等全自动（需 data/settings.json 里 llm.api_key）：
 *   npx tsx scripts/workshop-cli.ts --local-llm --topic "..."
 */

import { runWorkshopGenerate, type GenerateInput } from "../server/workshop.js";
import type { PlatformId } from "../server/content/ir.js";

const PLATFORMS = new Set<PlatformId>(["wechat", "carousel", "xiaohongshu", "script", "markdown", "txt"]);

const PLATFORM_ALIASES: Record<string, PlatformId> = {
  xhs: "xiaohongshu",
  贴图: "carousel",
};

function usage(): string {
  return `文枢创意工坊 CLI

Agent 模式（推荐，无需 API Key）：
  1. Read server/workshop-prompts.ts，按人格写 IR → output/article/{slug}.json
  2. npx tsx scripts/workshop-cli.ts --ir-file output/article/{slug}.json --platforms wechat

用法:
  npx tsx scripts/workshop-cli.ts [选项]

选项:
  --ir-file <path>            Agent 已写入的 IR（output/article/{slug}.json），渲染各平台变体
  --pick-topic-only           仅抽一条热搜选题（JSON 输出，无需 LLM）
  --local-llm                 走 data/settings.json 本地 LLM 全自动（网页同等）
  --topic <text>              话题
  --random-hot                先从热搜源选题（配合 --local-llm）
  --reference-urls <urls>     参考链接
  --reference-ratio <0-1>     借鉴比例
  --platforms <list>          wechat,carousel,xiaohongshu,script,markdown,txt（carousel 别名：贴图）
  --template-id <id>          微信模板 id
  --auto-search / --no-auto-search
  --json                      stdin JSON（可含 ir 对象或字段）
  --help

示例:
  npx tsx scripts/workshop-cli.ts --pick-topic-only
  npx tsx scripts/workshop-cli.ts --ir-file "output/article/我的标题.json" --platforms carousel
  npx tsx scripts/workshop-cli.ts --local-llm --topic "本地 AI 写作"
`;
}

function parsePlatforms(raw?: string): PlatformId[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => PLATFORM_ALIASES[s] ?? s) as PlatformId[];
  const bad = ids.filter((id) => !PLATFORMS.has(id));
  if (bad.length) throw new Error(`未知平台: ${bad.join(", ")}`);
  return ids;
}

type CliFlags = GenerateInput & {
  randomHot?: boolean;
  jsonStdin?: boolean;
  pickTopicOnly?: boolean;
};

function parseArgs(argv: string[]): CliFlags {
  const out: CliFlags = {};
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
      case "--ir-file":
        out.irFile = argv[++i];
        break;
      case "--pick-topic-only":
        out.pickTopicOnly = true;
        break;
      case "--local-llm":
        out.localLlm = true;
        break;
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

  if (parsed.pickTopicOnly) {
    const { pickRandomHotTopic } = await import("../server/hot/index.js");
    const picked = await pickRandomHotTopic();
    process.stdout.write(JSON.stringify(picked, null, 2) + "\n");
    return;
  }

  let input: GenerateInput = parsed;

  if (parsed.jsonStdin) {
    const fromStdin = await readStdinJson();
    input = { ...fromStdin, ...parsed };
  }

  const randomHot = parsed.randomHot;
  delete (input as CliFlags).randomHot;
  delete (input as CliFlags).jsonStdin;
  delete (input as CliFlags).pickTopicOnly;

  if (randomHot && !input.topic?.trim() && !input.ir && !input.irFile) {
    const { pickRandomHotTopic } = await import("../server/hot/index.js");
    const picked = await pickRandomHotTopic();
    input.topic = picked.topic;
    console.error(`[info] 热搜选题：[${picked.sourceName}] ${picked.topic}`);
  }

  const result = await runWorkshopGenerate(input, (level, message) => {
    console.error(`[${level}] ${message}`);
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((e: Error) => {
  console.error(`[error] ${e.message || String(e)}`);
  process.exit(1);
});
