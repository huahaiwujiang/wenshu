# 文枢 Agent API 参考

Base URL 默认：`http://127.0.0.1:8787`（环境变量 `WENSHU_PORT` 可改端口）

> **Agent `/workshop` 入口不走本节生成 API**，而是对话内写 IR + CLI `--ir-file` 落盘。以下供网页创意工坊或 `--local-llm` 参考。

## 生成

`POST /api/generate` — SSE 流（需 `data/settings.json` 里 `llm.api_key`）

请求体字段（均可选，缺省读 `data/settings.json`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| topic | string | 话题；空则随机热搜 |
| referenceUrls | string | 参考 URL，逗号/换行分隔 |
| referenceRatio | number | 0~1 借鉴比例 |
| platforms | string[] | wechat / carousel / xiaohongshu / script / markdown / txt |
| autoSearch | boolean | 无链接时是否检索 |
| templateId | string | 微信 HTML 模板 id |

SSE 事件：
- `event: log` — `{ level, message, at }`
- `event: done` — `{ topic, title, slug, irFile, variants, platforms, cover, source? }`
- `event: error` — `{ message }`

## 热搜

- `GET /api/hot/sources` — 源列表与启用状态
- `GET /api/hot/:sourceId` — 某源话题列表
- `POST /api/hot/random` — 随机一条（body `{}`）

## 文章

- `GET /api/articles` — 列表
- `GET /api/articles/:name` — 读单文件内容
- `PUT /api/articles/:name` — 保存
- `POST /api/articles/:name/rerender` — 保存 IR 并重渲染变体
- `DELETE /api/articles/:name` — 删除 IR 包
- `GET /api/articles/:name/download` — 下载

## 发布

- `GET /api/publishers` — 可用发布器
- `POST /api/publish` — `{ platform, article }`，微信填 `{slug}.json` 或 `{slug}.wechat.html`

## 配置

- `GET /api/settings` / `PUT /api/settings`
- `GET /api/platforms` — 平台元数据

## 落盘结构

```
output/article/
  {slug}.json           # IR 真源
  {slug}.wechat.html    # 平台 ID: wechat
  {slug}.carousel.txt   # 贴图配文（信息总结，不含文件名）
  {slug}.xhs.txt        # 平台 ID: xiaohongshu（文件名用 xhs）
  {slug}.script.txt     # 平台 ID: script
  {slug}.md             # 若启用 markdown
  {slug}.txt            # 若启用 txt
```

平台 ID（CLI / API `platforms`）与文件名后缀对照：`wechat` → `.wechat.html`；`carousel`（别名 `贴图`）→ `.carousel.txt`；`xiaohongshu`（CLI 可写 `xhs`）→ `.xhs.txt`；`script` → `.script.txt`。IR 内对应字段为 `xhsBeats`、`scriptBeats`。

热搜源 `weixin`（公众号热榜，未接入）与渲染平台 `wechat` 是不同概念，勿互换。
