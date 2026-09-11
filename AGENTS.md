# 文枢 — Agent 协作说明

完整流程见 **`.cursor/skills/workshop/SKILL.md`**。

## 快速入口

```
/workshop 话题，要微信和小红书
/workshop 随机热搜，贴图模式
```

**分工（无需 `llm.api_key`）：** 贴图 → 搜 `data/assets/` → 写 HTML 到 `{日期}/draft/` 等人审 → 通过后出图到同级 PNG（见 `carousel-images.md`）。长文/小红书/口播 → Read `server/workshop-prompts.ts` → Write IR → 去 AI → `--ir-file` CLI。

| 工具 | 入口 |
|------|------|
| Cursor | `/workshop` → `.cursor/skills/workshop/SKILL.md` |
| Claude Code | `/workshop` → `.claude/commands/workshop.md` |

## 常用 CLI

```bash
npx tsx scripts/workshop-cli.ts --pick-topic-only
npx tsx scripts/workshop-cli.ts --ir-file "output/article/标题.json" --platforms wechat
npx tsx scripts/workshop-cli.ts --local-llm --topic "话题"   # 需 api_key
```

## 网页

`npm run dev` → http://127.0.0.1:5173

## 例外

用户明确「只要聊天草稿、不要落盘」时可不走工坊。
