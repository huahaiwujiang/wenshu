---
name: workshop
description: >-
  文枢创意工坊斜杠命令。/workshop 后解析需求：Agent 用对话内模型生成 IR，
  写入 output/article/{slug}.json，CLI 渲染各平台变体；禁止要求 llm.api_key。
disable-model-invocation: true
---

# /workshop — 文枢创意工坊

用户已通过 **`/workshop`** 唤起。**不要**走 `POST /api/generate`（那是网页本地 LLM），**不要**要求用户填写 `llm.api_key`。

## 分工

| 步骤 | 谁做 | 说明 |
|------|------|------|
| 选题 / 读参考 | **Agent（你）** | WebFetch、用户给的 URL、或 `--pick-topic-only` |
| 写 IR JSON | **Agent（你）** | Read [`server/workshop-prompts.ts`](../../../server/workshop-prompts.ts)，按人格与 IR 结构生成 |
| 落盘真源 | **Agent（你）** | Write → `output/article/{slug}.json`（**唯一真源，无中间文件**） |
| 渲染变体 | **CLI** | `--ir-file output/article/{slug}.json`，生成 `.wechat.html` / `.carousel.txt` 等 |

## slug 规则

`slug` = IR 的 `title` 经 `safeFileName` 处理（去非法字符、空格归一，最长 80 字）。  
`topic` 可保留完整原话题供追溯。

## 选题

| 模式 | 用户怎么说 |
|------|-----------|
| 自选话题 | 直接写话题，不抽热搜 |
| 当前热门 | 留空 / 「随机」「热搜」→ `npx tsx scripts/workshop-cli.ts --pick-topic-only` |

`--pick-topic-only` 输出 `{ topic, sourceId, sourceName, … }`；写 IR 时把 `{ id: sourceId, name: sourceName }` 放进 `meta.hotSource`（可选）。

## 标准流程（必须）

1. 解析平台、参考链接、借鉴比例等
2. 阅读参考素材（若有 URL）；摘要写入 IR `sources`
3. **Read `server/workshop-prompts.ts`** — 合规 + `WORKSHOP_PERSONA` + `WRITING_STANDARDS`（标题抓眼球；`digest` ≤54 字）
4. 计算 `slug`，**Write `output/article/{slug}.json`**（完整 IR，含 `schemaVersion: 1`、`meta.createdAt`）
5. CLI 渲染变体：

```bash
npx tsx scripts/workshop-cli.ts --ir-file "output/article/{slug}.json" --platforms wechat,xiaohongshu,script
```

6. 根据 stdout JSON 汇报路径；预览读 `output/article/` 下文件，**不要在聊天里重写一篇当交付**

## 平台（`--platforms`）

| 用户说法 | 平台 ID | 产出 |
|---------|---------|------|
| 微信长文 / 公众号 HTML | `wechat` | `{slug}.wechat.html` |
| 贴图 / 多图配文 | `carousel` 或 `贴图` | `{slug}.carousel.txt`（贴图配文：参考素材/配图的信息总结） |
| 小红书 | `xiaohongshu` 或 `xhs` | `{slug}.xhs.txt` |
| 口播 / 短视频 | `script` | `{slug}.script.txt` |

**贴图模式**：`--platforms carousel`，**不要** `wechat`。必读 `CAROUSEL_IR_GUIDE`：
- 先读 Release/参考链接或理解配图内容，再写 IR
- `sections` 每节 = 一张图的主题 + 1～3 句**信息总结**（主编口吻，有角度）
- **禁止**在 IR 里写 `【配图：xxx.png】`——那是制作流程，不是读者配文
- 图片另存 `output/wechat-images/`，与文字分开

用户未指定平台时：Read `data/settings.json` 的 `workshop.platforms`；读不到则默认 `wechat,xiaohongshu,script`。

### 命名对照

| 场景 | 用什么 |
|------|--------|
| CLI `--platforms` / IR `meta.platforms` | `wechat`、`carousel`、`xiaohongshu`（别名 `xhs`）、`script` |
| 落盘文件名 | `{slug}.json`（真源）、`{slug}.wechat.html`、`{slug}.carousel.txt` … |
| IR 字段 | `xhsBeats`、`scriptBeats` |

热搜源 `weixin`（热榜，未接入）≠ 渲染平台 `wechat`（长文 HTML）。

## 合规

见 `server/workshop-prompts.ts` → `WORKSHOP_GUARDRAILS`。碰红线先提醒、拒写或换角度。

## 禁止

- 写 `.cursor/workshop-ir.json` 或其它中间 IR 文件（真源只在 `output/article/`）
- 因缺少 `llm.api_key` 停下来
- `npm run workshop -- --topic ...` 且不带 `--ir-file`
- 跳过落盘，只在聊天给完稿

## 仅当用户明确要求时

- `--local-llm` + 已配置 `data/settings.json` → 网页同等全自动（本地 LLM 直接写 IR 并落盘，无需 Agent 先 Write json）

## 发布公众号草稿

需 `npm run dev` + `wechat.appid/appsecret`。长文用 `wechat` 平台；贴图模式一般手动发，不走 HTML 草稿。

`POST http://127.0.0.1:8787/api/publish`，body `{ "platform": "wechat", "article": "{slug}.json" }`

## 其他

- CLI 支持 `--json` stdin 传 `ir`（自动化）
- API 细节：[reference.md](reference.md)
