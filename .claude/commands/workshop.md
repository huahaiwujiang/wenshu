---
description: 文枢创意工坊 — Agent 写 IR 到 output/article，CLI 渲染变体（无需 api_key）
argument-hint: [话题 或 随机热搜；可选平台、参考链接]
---

用户请求：$ARGUMENTS

**完整流程**见 `.cursor/skills/workshop/SKILL.md`。摘要：

1. 不要要求 `llm.api_key`；不要写 `.cursor/workshop-ir.json`
2. Read `server/workshop-prompts.ts`（人格 + WRITING_STANDARDS + WORKSHOP_DESLOP + 贴图读 CAROUSEL_IR_GUIDE），写 IR → **`output/article/{slug}.json`**
3. **去 AI**：Read `.cursor/skills/workshop/deslop.md`，扫 IR 可读字段并写回同一 json（用户明示跳过除外）
4. `npx tsx scripts/workshop-cli.ts --ir-file "output/article/{slug}.json" --platforms …`
   - 贴图 → `carousel`；长文 → `wechat`；小红书 → `xhs`
5. 汇报 `output/article/` 路径

禁止：仅 `--topic` 调 CLI；禁止只聊天给完稿；禁止跳过去 AI 直接渲染（明示跳过除外）。
