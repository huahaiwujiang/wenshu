# 文枢 Agent API 参考

Base URL 默认：`http://127.0.0.1:8787`（环境变量 `WENSHU_PORT` 可改端口）

## 生成

`POST /api/generate` — SSE 流

请求体字段（均可选，缺省读 `data/settings.json`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| topic | string | 话题；空则随机热搜 |
| referenceUrls | string | 参考 URL，逗号/换行分隔 |
| referenceRatio | number | 0~1 借鉴比例 |
| platforms | string[] | wechat / xiaohongshu / script / markdown / txt |
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
  {slug}.wechat.html
  {slug}.xhs.txt
  {slug}.script.txt
  {slug}.md             # 若启用 markdown
  {slug}.txt            # 若启用 txt
```
