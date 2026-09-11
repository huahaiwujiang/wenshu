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
| 渲染变体 | **CLI** | `--ir-file` 渲微信/小红书/口播等；**贴图不走 CLI**，Agent 直接出图 |

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
2. **搜本地资源库** [`data/assets/`](../../../data/assets/)：按话题/品牌**文件夹名**匹配（如 `deepseek`）。命中则 Read 该夹 `README.md` 并在配图中使用，禁止自绘已有 logo / 立绘。同时阅读用户给的 URL（若有）
3. **纯贴图**：Read [carousel-images.md](carousel-images.md) → 建批次目录 → HTML 写入 `{批次}/draft/` → **等人审通过后再截图**；PNG 与 `draft/` 同级落在批次根下（`YYYY-MM-DD/`，同日已有则 `YYYY-MM-DD-HH-MM/`），汇报路径即结束（不写 IR、不去 AI、不跑 CLI）
4. 若还要长文/小红书/口播：摘要写入 IR `sources`；**Read `server/workshop-prompts.ts`** — 合规 + `WORKSHOP_PERSONA` + `WRITING_STANDARDS` + `WORKSHOP_DESLOP`（标题抓眼球；`digest` ≤54 字）
5. 计算 `slug`，**Write `output/article/{slug}.json`**（完整 IR，含 `schemaVersion: 1`、`meta.createdAt`）
6. **去 AI（强制）**：Read [deslop.md](deslop.md)，按 Gate A→F 扫 IR 可读字段并写回同一 json；用户明示「不去 AI」可跳过并在汇报注明。借鉴自 web-novelist `story-deslop`（改味不改事实），**勿照搬网文情绪外化规则**
7. CLI 渲染文案变体（**不要** `carousel`）：

```bash
npx tsx scripts/workshop-cli.ts --ir-file "output/article/{slug}.json" --platforms wechat,xiaohongshu,script
```

8. 根据 stdout JSON 汇报路径；预览读 `output/article/` 与 `output/wechat-images/`，**不要在聊天里重写一篇当交付**

## 平台（`--platforms`）

| 用户说法 | 平台 ID | 产出 |
|---------|---------|------|
| 微信长文 / 公众号 HTML | `wechat` | `{slug}.wechat.html` |
| 贴图 | `carousel` 或 `贴图` | **只出图** → `YYYY-MM-DD/draft/` + 同级 PNG（无配文；先审 HTML） |
| 小红书 | `xiaohongshu` 或 `xhs` | `{slug}.xhs.txt` |
| 口播 / 短视频 | `script` | `{slug}.script.txt` |

**贴图模式**：只做图。**不要** `--platforms carousel`，**不要** 写 `{slug}.carousel.txt`。必读 [carousel-images.md](carousel-images.md)：
- 气质对标 [`data/assets/_style/`](../../../data/assets/_style/)（浅底、亮色、大留白、可有角色），活泼明亮，不要深色清单海报
- 先搜 [`data/assets/`](../../../data/assets/) 主题夹，**构图里用上** logo / 立绘 / Q 版，禁止自绘已有素材
- 先写 HTML 到 `{批次}/draft/`，**用户确认后再截图**；竖版约 1080×1440
- 批次目录 `output/wechat-images/YYYY-MM-DD/`（同日已有则 `YYYY-MM-DD-HH-MM/`）；PNG 与 `draft/` 同级；勿用冒号
- 纯贴图不必写 IR、不必去 AI、不必 CLI；同时要长文/小红书时 IR 只服务那些平台

用户未指定平台时：Read `data/settings.json` 的 `workshop.platforms`；读不到则默认 `wechat,xiaohongshu,script`。

### 命名对照

| 场景 | 用什么 |
|------|--------|
| CLI `--platforms` / IR `meta.platforms` | `wechat`、`xiaohongshu`（别名 `xhs`）、`script`（`carousel` 只表示贴图出图，CLI 不渲 txt） |
| 落盘文件名 | `{slug}.json`（真源）、`{slug}.wechat.html`、`{slug}.xhs.txt` …；贴图在 `output/wechat-images/YYYY-MM-DD/`（`draft/` + PNG） |
| IR 字段 | `xhsBeats`、`scriptBeats` |

热搜源 `weixin`（热榜，未接入）≠ 渲染平台 `wechat`（长文 HTML）。

## 资源库

路径：[`data/assets/`](../../../data/assets/)。一级子目录按主题命名（`deepseek`、`harness` …）。贴图气质标杆在 [`_style/`](../../../data/assets/_style/)。约定见 [`data/assets/README.md`](../../../data/assets/README.md)。可复用素材放主题夹；单次成稿进 `output/wechat-images/YYYY-MM-DD/`（其下 `draft/` + PNG，见 [carousel-images.md](carousel-images.md)）。

## 合规

见 `server/workshop-prompts.ts` → `WORKSHOP_GUARDRAILS`。碰红线先提醒、拒写或换角度。

## 禁止

- 贴图模式写 `{slug}.carousel.txt` 或 `--platforms carousel` 渲配文
- 贴图 HTML 草稿未获用户确认就截图出 PNG
- 跳过 `data/assets/` 直接现画库里已有的 logo / 立绘
- 写 `.cursor/workshop-ir.json` 或其它中间 IR 文件（真源只在 `output/article/`）
- 因缺少 `llm.api_key` 停下来
- `npm run workshop -- --topic ...` 且不带 `--ir-file`
- 跳过落盘，只在聊天给完稿
- 跳过去 AI 步骤直接渲染（用户明示跳过除外）

## 仅当用户明确要求时

- `--local-llm` + 已配置 `data/settings.json` → 网页同等全自动（本地 LLM 直接写 IR 并落盘，无需 Agent 先 Write json）

## 发布公众号草稿

需 `npm run dev` + `wechat.appid/appsecret`。长文用 `wechat` 平台；贴图只发图、无配文草稿。

`POST http://127.0.0.1:8787/api/publish`，body `{ "platform": "wechat", "article": "{slug}.json" }`

## 其他

- CLI 支持 `--json` stdin 传 `ir`（自动化）
- API 细节：[reference.md](reference.md)
