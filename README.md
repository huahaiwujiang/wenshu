# 文枢

本地 Node Web 写作台：创意工坊、文章管理、模板管理、系统设置。  
无数据库：配置/模板在 `data/`，成稿与配图在 `output/article`、`output/wechat-images`。

## 能力概览（v0.2）

1. **选题**：热搜（留空或 `--random-hot`）或手填话题（`--topic` / positional）  
2. **素材**：参考 URL 借鉴 / 自动检索摘要  
3. **IR 中间表示**：结构化 JSON 真源  
4. **方向 D 多平台渲染**：微信 HTML、小红书文案、口播稿；可选另存 Markdown / TXT  
5. **封面**：本地 `wechat-images` 或 Picsum → 微信草稿  
6. **编辑**：文章可改；IR 可「保存并重渲染」各平台变体  

落盘示例：`标题.json` + `标题.wechat.html` + `标题.xhs.txt` + `标题.script.txt`

## 双入口

| 入口 | 用法 |
|------|------|
| **斜杠命令** | Cursor：`/workshop 话题，要微信和小红书` · Claude Code：同上 |
| **网页** | `npm run dev` → http://127.0.0.1:5173 创意工坊 |

示例：

```
/workshop AI 提效，微信+小红书+口播     ← 自选话题
/workshop 随机热搜                       ← 当前热门
/workshop                                ← 留空 = 随机热搜
/workshop 参考 https://example.com/a 写本地 LLM，借鉴 30%
```

Agent 配置见 [AGENTS.md](./AGENTS.md) 与 `.cursor/skills/workshop/`。

CLI 等价命令：

```bash
npm run workshop -- "话题标题"
npm run workshop -- --random-hot
```

## 启动

```bash
cd wenshu
npm install
npm run dev
```

- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:8787（Vite 已代理 `/api`）

生产模式：先 `npm run build`，再 `npm start`（Hono 同时托管前端静态资源）。

## 配置

编辑或通过「系统设置」页保存 `data/settings.json`：

- `llm.base_url` / `api_key` / `model`：OpenAI 兼容接口
- `wechat`：公众号草稿箱凭据
- `workshop.platforms`：默认渲染平台
- `workshop.format`：额外 raw（html / markdown / txt）
- `workshop.coverMode`：local | picsum | none
- `hotSources`：热搜源开关（含 bilibili）
- `agent.requireWorkshopFlow`：协作 Agent 是否必须走创意工坊（默认 true）
- `agent.preferredEntry`：`cli`（`npm run workshop`）或 `api`（HTTP）
