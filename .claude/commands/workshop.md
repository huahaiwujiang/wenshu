---
description: 文枢创意工坊 — Agent 生成 IR，CLI 渲染落盘（无需 api_key）
argument-hint: [话题 或 随机热搜；可选平台、参考链接]
---

用户请求：$ARGUMENTS

**完整流程**见仓库 `.cursor/skills/workshop/SKILL.md`。摘要：

1. 不要要求 `llm.api_key`；不要走 `POST /api/generate`
2. 选题：自选或 `npx tsx scripts/workshop-cli.ts --pick-topic-only`
3. Read `server/workshop-prompts.ts`，写 IR（含 `sources`、54 字内 `digest`）→ `.cursor/workshop-ir.json`
4. `npx tsx scripts/workshop-cli.ts --ir-file .cursor/workshop-ir.json --platforms …`（小红书可用别名 `xhs`）
5. 汇报 `output/article/` 路径

禁止：仅 `--topic` 调 CLI；禁止只聊天给完稿不落盘。
