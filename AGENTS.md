# 文枢 — Agent 协作说明

完整流程见 **`.cursor/skills/workshop/SKILL.md`**。

## 快速入口

```
/workshop 话题，要微信和小红书
/workshop 随机热搜，贴图模式
```

**分工（无需 `llm.api_key`）：** Read `server/workshop-prompts.ts` → Write `output/article/{slug}.json` → `--ir-file` CLI 渲染变体。

| 工具 | 入口 |
|------|------|
| Cursor | `/workshop` → `.cursor/skills/workshop/SKILL.md` |
| Claude Code | `/workshop` → `.claude/commands/workshop.md` |

## 常用 CLI

```bash
npx tsx scripts/workshop-cli.ts --pick-topic-only
npx tsx scripts/workshop-cli.ts --ir-file "output/article/标题.json" --platforms carousel
npx tsx scripts/workshop-cli.ts --local-llm --topic "话题"   # 需 api_key
```

## 网页

`npm run dev` → http://127.0.0.1:5173

## 例外

用户明确「只要聊天草稿、不要落盘」时可不走工坊。
