import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import fs from "node:fs";
import path from "node:path";
import { PLATFORM_META, type ArticleIR, type PlatformId } from "./content/ir.js";
import { formatToPlatform, renderPlatform } from "./content/renderers.js";
import {
  deleteArticle,
  deleteTemplate,
  ensureDataDirs,
  listArticles,
  listTemplates,
  readArticle,
  readArticleIR,
  readSettings,
  readTemplate,
  writeArticleContent,
  writeSettings,
  writeTemplate,
} from "./files.js";
import { fetchSourceTopics, listHotSourceMeta, pickRandomHotTopic } from "./hot/index.js";
import { ARTICLES_DIR, WEB_DIST } from "./paths.js";
import { listPublishers, publishArticle } from "./publish/index.js";
import { runWorkshopGenerate } from "./workshop.js";

const app = new Hono();
const PORT = Number(process.env.WENSHU_PORT || 8787);

app.use(
  "/api/*",
  cors({
    origin: ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8787", "http://localhost:8787"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true, name: "文枢", version: "0.2.0" }));

app.get("/api/platforms", (c) =>
  c.json({
    status: "success",
    data: Object.values(PLATFORM_META),
  }),
);

app.get("/api/settings", async (c) => {
  const settings = await readSettings();
  return c.json({ status: "success", data: settings });
});

app.put("/api/settings", async (c) => {
  const body = await c.req.json();
  const next = await writeSettings(body);
  return c.json({ status: "success", data: next });
});

app.get("/api/hot/sources", async (c) => {
  const settings = await readSettings();
  const meta = listHotSourceMeta().map((s) => ({
    ...s,
    enabled: Boolean((settings.hotSources as Record<string, boolean>)[s.id]),
  }));
  return c.json({ status: "success", data: meta });
});

app.get("/api/hot/:sourceId", async (c) => {
  const sourceId = c.req.param("sourceId");
  try {
    const topics = await fetchSourceTopics(sourceId);
    return c.json({ status: "success", data: topics });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 502);
  }
});

app.post("/api/hot/random", async (c) => {
  try {
    const picked = await pickRandomHotTopic();
    return c.json({ status: "success", data: picked });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 502);
  }
});

app.get("/api/articles", async (c) => {
  const data = await listArticles();
  return c.json({ status: "success", data });
});

app.get("/api/articles/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const content = await readArticle(name);
    return c.json({ status: "success", data: { name, content } });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 404);
  }
});

app.put("/api/articles/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const body = await c.req.json();
    const content = String(body?.content ?? "");
    await writeArticleContent(name, content);
    return c.json({ status: "success", data: { name } });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 400);
  }
});

/** 保存 IR 并按当前设置重新渲染各平台变体 */
app.post("/api/articles/:name/rerender", async (c) => {
  try {
    const name = c.req.param("name");
    const body = await c.req.json().catch(() => ({}));
    const { slug, ir: existing } = await readArticleIR(name);
    let ir: ArticleIR = existing;
    if (body?.ir && typeof body.ir === "object") {
      ir = { ...existing, ...body.ir, schemaVersion: 1, meta: { ...existing.meta, ...(body.ir.meta || {}) } };
    } else if (typeof body?.content === "string") {
      ir = JSON.parse(body.content) as ArticleIR;
      ir.schemaVersion = 1;
      ir.meta = { ...existing.meta, ...(ir.meta || {}) };
    }
    ir.meta.updatedAt = new Date().toISOString();

    const settings = await readSettings();
    const wanted = new Set<PlatformId>(settings.workshop.platforms as PlatformId[]);
    const fromFormat = formatToPlatform(settings.workshop.format);
    if (fromFormat) wanted.add(fromFormat);
    if (settings.workshop.format === "html") wanted.add("wechat");

    let templateHtml: string | undefined;
    if (settings.workshop.useTemplate && settings.workshop.defaultTemplate) {
      try {
        templateHtml = (await readTemplate(settings.workshop.defaultTemplate)).content;
      } catch {
        /* ignore */
      }
    }

    const variants = [...wanted].map((platform) => {
      const rendered = renderPlatform(platform, ir, { templateHtml });
      return {
        platform,
        filename: `${rendered.filenameSuffix}.${rendered.ext}`,
        content: rendered.content,
      };
    });

    // 覆盖同 slug
    const variantNames: string[] = [];
    for (const v of variants) {
      const filename = `${slug}.${v.filename}`;
      await fs.promises.writeFile(path.join(ARTICLES_DIR, filename), v.content, "utf-8");
      variantNames.push(filename);
    }
    ir.meta.platforms = variants.map((v) => v.platform);
    await fs.promises.writeFile(path.join(ARTICLES_DIR, `${slug}.json`), JSON.stringify(ir, null, 2), "utf-8");

    return c.json({
      status: "success",
      data: { slug, irFile: `${slug}.json`, variants: variantNames, platforms: ir.meta.platforms },
    });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 400);
  }
});

app.delete("/api/articles/:name", async (c) => {
  try {
    await deleteArticle(c.req.param("name"));
    return c.json({ status: "success" });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 400);
  }
});

app.get("/api/articles/:name/download", async (c) => {
  try {
    const name = c.req.param("name");
    const content = await readArticle(name);
    return new Response(content, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 404);
  }
});

app.get("/api/templates", async (c) => {
  const data = await listTemplates();
  return c.json({ status: "success", data });
});

app.get("/api/templates/:id", async (c) => {
  try {
    const data = await readTemplate(c.req.param("id"));
    return c.json({ status: "success", data });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 404);
  }
});

app.put("/api/templates/:id", async (c) => {
  try {
    const body = await c.req.json();
    const content = String(body?.content ?? "");
    const name = await writeTemplate(c.req.param("id"), content);
    return c.json({ status: "success", data: { name } });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 400);
  }
});

app.delete("/api/templates/:id", async (c) => {
  try {
    await deleteTemplate(c.req.param("id"));
    return c.json({ status: "success" });
  } catch (e: any) {
    return c.json({ status: "error", message: e?.message || String(e) }, 400);
  }
});

app.get("/api/publishers", (c) => c.json({ status: "success", data: listPublishers() }));

app.post("/api/publish", async (c) => {
  const body = await c.req.json();
  const platform = String(body?.platform || "wechat");
  const article = String(body?.article || "");
  if (!article) return c.json({ status: "error", message: "缺少 article" }, 400);
  const result = await publishArticle(platform, article);
  return c.json({ status: result.ok ? "success" : "error", data: result, message: result.message });
});

app.post("/api/generate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return streamSSE(c, async (stream) => {
    const send = async (event: string, data: unknown) => {
      await stream.writeSSE({ event, data: JSON.stringify(data) });
    };
    const log = async (level: "info" | "warn" | "error", message: string) => {
      await send("log", { level, message, at: new Date().toISOString() });
    };
    try {
      await log("info", "开始生成（IR → 多平台）…");
      const result = await runWorkshopGenerate(
        {
          topic: body?.topic,
          templateId: body?.templateId,
          referenceUrls: body?.referenceUrls,
          referenceRatio: body?.referenceRatio,
          platforms: body?.platforms,
          autoSearch: body?.autoSearch,
        },
        async (level, message) => {
          await log(level, message);
        },
      );
      await send("done", result);
    } catch (e: any) {
      await send("error", { message: e?.message || String(e) });
    }
  });
});

// 生产：托管 Vue 构建产物
if (fs.existsSync(path.join(WEB_DIST, "index.html"))) {
  app.use("/*", serveStatic({ root: path.relative(process.cwd(), WEB_DIST) }));
  app.get("*", async (c) => {
    const html = await fs.promises.readFile(path.join(WEB_DIST, "index.html"), "utf-8");
    return c.html(html);
  });
}

await ensureDataDirs();

console.log(`[文枢] API http://127.0.0.1:${PORT}`);
serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" });
