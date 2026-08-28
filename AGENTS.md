# 文枢 — Agent 协作说明

## 斜杠命令（推荐）

在 Cursor / Claude Code 中输入：

```
/workshop AI 工具如何提升写作效率，要微信和小红书    ← 自选话题，跳过热搜
/workshop 随机热搜，口播也要                          ← 用当前热门
/workshop                                            ← 仅 /workshop，等同随机热搜
/workshop 参考 https://example.com/a 写本地 LLM，借鉴 30%
```

Agent 会解析需求 → 跑创意工坊 CLI → 落盘到 `output/article/`，**不会**在聊天里直接代写正文。

| 工具 | 配置位置 |
|------|----------|
| **Cursor** | `.cursor/skills/workshop/SKILL.md`（输入 `/workshop`） |
| **Claude Code** | `.claude/commands/workshop.md` |
| **旧版 Cursor 命令** | `.cursor/commands/workshop.md`（兼容） |

## 网页入口

`npm run dev` → http://127.0.0.1:5173 创意工坊（表单 + 日志 + 发布）

## CLI（Agent 内部调用）

```bash
npm run workshop -- "话题标题"
npm run workshop -- --random-hot
npx tsx scripts/workshop-cli.ts --topic "..." --platforms wechat,xiaohongshu
```

## 配置

- LLM / 工坊：`data/settings.json`（见 `data/settings.example.json`）
- `agent.requireWorkshopFlow`：默认 true；设为 false 可允许 Agent 不走工坊（一般不推荐）

## 例外

用户明确说「只要聊天草稿、不要落盘」时，可不调用工坊。
