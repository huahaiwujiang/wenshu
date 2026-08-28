---
name: workshop
description: >-
  文枢创意工坊斜杠命令。/workshop 后解析需求：Agent 用对话内模型生成 IR，
  CLI 渲染落盘；禁止再要求 settings.llm.api_key，禁止只输出正文不落盘。
disable-model-invocation: true
---

# /workshop — 文枢创意工坊

用户已通过 **`/workshop`** 唤起。**不要**走 `POST /api/generate`（那是网页本地 LLM），**不要**要求用户填写 `llm.api_key`。

## 分工

| 步骤 | 谁做 | 说明 |
|------|------|------|
| 选题 / 读参考 | **Agent（你）** | WebFetch、用户给的 URL、或 `--pick-topic-only` |
| 提纲 + IR JSON | **Agent（你）** | Read [`server/workshop-prompts.ts`](../../../server/workshop-prompts.ts)，按其中人格与 IR 结构生成 |
| 封面 / 渲染 / 落盘 | **CLI** | `--ir-file`，无需 API Key |

## 选题

| 模式 | 用户怎么说 |
|------|-----------|
| 自选话题 | 直接写话题，不抽热搜 |
| 当前热门 | 留空 / 「随机」「热搜」→ `npx tsx scripts/workshop-cli.ts --pick-topic-only` |

`--pick-topic-only` 输出 `{ topic, sourceId, sourceName, … }`；写 IR 时把 `{ id: sourceId, name: sourceName }` 放进 `meta.hotSource`（可选，便于追溯）。

## 标准流程（必须）

1. 解析平台、参考链接、借鉴比例等
2. 阅读参考素材（若有 URL）；读到的摘要写入 IR `sources` 数组
3. **Read `server/workshop-prompts.ts`** — 合规过一遍，再按人格写 **IR JSON**（`digest` 54 字内）
4. 写入 `.cursor/workshop-ir.json`（Write 工具，运行时临时文件，不必入库）
5. 执行落盘（平台见下节）：

```bash
npx tsx scripts/workshop-cli.ts --ir-file .cursor/workshop-ir.json --platforms wechat,xiaohongshu,script
```

6. 根据 stdout JSON 汇报 `output/article/` 路径；预览时读文件，**不要**在聊天里重写一篇当交付

## 平台（`--platforms`）

| 用户说法 | 平台 ID |
|---------|---------|
| 微信 / 公众号 | `wechat` |
| 小红书 | `xiaohongshu` 或别名 `xhs` |
| 口播 / 短视频 | `script` |

用户未指定平台时：Read `data/settings.json` 的 `workshop.platforms`；读不到则用默认 `wechat,xiaohongshu,script`。

### 命名对照（勿混用）

| 场景 | 用什么 | 示例 |
|------|--------|------|
| CLI `--platforms` / IR `meta.platforms` | 平台 ID | `wechat`、`xiaohongshu`（别名 `xhs`）、`script` |
| 落盘文件名 | 平台后缀 | `{slug}.wechat.html`、`{slug}.xhs.txt`、`{slug}.script.txt` |
| IR JSON 字段 | 平台专属内容 | `xhsBeats`（小红书短句）、`scriptBeats`（口播分镜） |

**易混：** 热搜源 `weixin`（公众号热榜，设置里 `hotSources.weixin`，暂未接入）≠ 渲染/发布平台 `wechat`（微信公众号文章）。选题来自热搜时用 `sourceId`；渲染落盘用 `wechat`。

## 合规

用户要求歪曲、诽谤、造谣、人身攻击、煽动对立等 — **先提醒红线（封号/违法）**，拒写或换合法角度。细则见 `server/workshop-prompts.ts` → `WORKSHOP_GUARDRAILS`。

## 禁止

- 因缺少 `llm.api_key` 停下来让用户去配 Key（Agent 入口不需要）
- 用 `npm run workshop -- --topic ...` **且不带 `--ir-file`**（会尝试本地 LLM）
- 跳过 IR 落盘，只在聊天里给完稿

## 仅当用户明确要求时

- `--local-llm` + 已配置 `data/settings.json` → 网页同等全自动

## 发布公众号草稿

需先 `npm run dev`，并在 `data/settings.json` 填好 `wechat.appid` / `appsecret`。生成后：

`POST http://127.0.0.1:8787/api/publish`，body `{ "platform": "wechat", "article": "{slug}.json" }`

## 其他

- CLI 也支持 `--json` 从 stdin 传入含 `ir` 字段的 JSON（自动化场景）
- API 细节：[reference.md](reference.md)（Agent 落盘走 CLI，不走 `/api/generate`）
