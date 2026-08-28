---
name: workshop
description: >-
  文枢创意工坊斜杠命令。用户在 /workshop 后接自然语言需求时，解析意图并执行完整写稿流程
  （选题→素材→IR→多平台渲染→落盘），禁止在对话里直接代写正文。
disable-model-invocation: true
---

# /workshop — 文枢创意工坊

用户已通过 **`/workshop`** 唤起本流程。`/workshop` 后面的文字即需求，按下方规则解析并**立即执行**，不要在聊天里直接写稿。

## 选题（二选一，可跳过热搜）

| 模式 | 用户怎么说 | 执行 |
|------|-----------|------|
| **A. 自选话题** | `/workshop AI 如何提效` `/workshop 写关于本地 LLM 的稿` | `--topic "..."` **不要**加 `--random-hot` |
| **B. 当前热门** | `/workshop` `/workshop 随机` `/workshop 热搜` `/workshop 抽一条热门的` | `--random-hot` 或不传 `--topic`（留空即自动抽热搜） |

**规则：**
- 用户给出了**具体要写什么** → 模式 A，直接用该话题，**跳过热搜选题**
- 用户只要热门 / 没写话题 / 只写了平台（如「要微信+小红书」）→ 模式 B
- 两种模式都支持后面追加：平台、参考链接、借鉴比例等

## 解析其他意图

| 用户说法 | 映射 |
|---------|------|
| 微信 / 公众号 | platforms 含 `wechat` |
| 小红书 / xhs | platforms 含 `xiaohongshu` |
| 口播 / 短视频 / 脚本 | platforms 含 `script` |
| markdown / md | platforms 含 `markdown` |
| 参考 / 借鉴 + URL | `--reference-urls` |
| 借鉴 N% / 比例 | `--reference-ratio`（0~1） |
| 不要检索 / 关闭检索 | `--no-auto-search` |
| 模板 xxx | `--template-id` |
| 发公众号 / 发布草稿 | 生成后 `POST /api/publish`（需 Web 已启动） |

未指定平台 → 用 settings 里 `workshop.platforms` 默认值。

## 执行（必须）

```bash
# 模式 A：自选话题（跳过热搜）
npm run workshop -- "AI 工具如何提效"
npx tsx scripts/workshop-cli.ts --topic "AI 工具如何提效" --platforms wechat,xiaohongshu

# 模式 B：当前热门（不传 topic）
npm run workshop -- --random-hot
npm run workshop -- --random-hot --platforms wechat,xiaohongshu,script
npx tsx scripts/workshop-cli.ts --random-hot
```

## 完成后回复

1. 标题、`slug`、各变体路径（`output/article/` 下）
2.  stderr 里关键步骤一两句摘要
3. 若用户要预览：读 IR 或变体摘要，**不要**重写一篇
4. 可选：提示 `npm run dev` 打开网页管理 / 发布

## 禁止

- 跳过 CLI/API，在对话中输出「完整公众号/HTML/小红书正文」作为交付
- 跳过 IR（`*.json`）落盘

## 前置检查

- `data/settings.json` → `llm.api_key` 已填；否则提示用户配置后停止
- 更多 API：[reference.md](reference.md)
