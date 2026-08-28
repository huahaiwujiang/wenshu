---
description: 文枢创意工坊 — 自选话题或随机热搜，走完整写稿流程
argument-hint: [自选话题 或 随机/热搜/留空]
---

用户请求：$ARGUMENTS

## 选题

- **有具体话题**（如「AI 提效」「写本地 LLM」）→ `--topic "..."`，**不要**抽热搜
- **随机/热搜/热门/留空** → `--random-hot` 或不传 topic

## 步骤

1. 按上表判断选题模式，解析平台、参考链接等
2. 确认 `data/settings.json` → `llm.api_key`
3. 执行 `npx tsx scripts/workshop-cli.ts ...`（禁止在回复里直接写完整正文）
4. 汇报 `output/article/` 落盘路径
