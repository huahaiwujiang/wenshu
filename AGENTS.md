# 文枢 — Agent 协作说明

完整流程见 **`.cursor/skills/workshop/SKILL.md`**（Cursor / Claude Code 斜杠命令均遵循）。

## 快速入口

```
/workshop 话题，要微信和小红书
/workshop 随机热搜，口播也要
```

**分工（无需 `llm.api_key`）：** Read `server/workshop-prompts.ts` → 写 IR → `--ir-file` CLI 落盘 → 汇报 `output/article/`。

| 工具 | 入口 |
|------|------|
| Cursor | `/workshop` → `.cursor/skills/workshop/SKILL.md` |
| Claude Code | `/workshop` → `.claude/commands/workshop.md`（指向同上 Skill） |

## 常用 CLI

```bash
npx tsx scripts/workshop-cli.ts --pick-topic-only
npx tsx scripts/workshop-cli.ts --ir-file .cursor/workshop-ir.json --platforms wechat
npx tsx scripts/workshop-cli.ts --local-llm --topic "话题"   # 需 data/settings.json 里 api_key
```

## 网页

`npm run dev` → http://127.0.0.1:5173（创意工坊用本地 LLM，需 `llm.api_key`）

## 例外

用户明确「只要聊天草稿、不要落盘」时可不走工坊。
