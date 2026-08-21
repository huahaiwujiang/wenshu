import fs from "node:fs/promises";
import path from "node:path";
import { appendPublishRecord, readArticle, readArticleIR, readSettings } from "../files.js";

export type PublishResult = {
  ok: boolean;
  platform: string;
  message: string;
  mediaId?: string;
};

export type Publisher = {
  id: string;
  name: string;
  implemented: boolean;
  publish: (articleName: string) => Promise<PublishResult>;
};

async function getAccessToken(appid: string, secret: string): Promise<string> {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
  const res = await fetch(url);
  const data: any = await res.json();
  if (!data?.access_token) {
    throw new Error(data?.errmsg || "获取微信 access_token 失败");
  }
  return data.access_token as string;
}

/** 1x1 透明 PNG，用作草稿封面占位 */
const PLACEHOLDER_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

async function loadCoverBytes(
  articleName: string,
): Promise<{ bytes: Uint8Array; filename: string; contentType: string }> {
  // IR 包：优先 meta.coverPath
  try {
    const base = path.basename(articleName).replace(/\.(json|html|md|txt)$/i, "");
    const { ir } = await readArticleIR(`${base}.json`);
    const cover = ir.meta?.coverPath;
    if (cover) {
      if (/^https?:\/\//i.test(cover)) {
        const res = await fetch(cover);
        if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          return {
            bytes,
            filename: "cover.jpg",
            contentType: res.headers.get("content-type") || "image/jpeg",
          };
        }
      } else {
        const bytes = new Uint8Array(await fs.readFile(cover));
        const ext = path.extname(cover).toLowerCase();
        return {
          bytes,
          filename: path.basename(cover) || "cover.png",
          contentType:
            ext === ".png"
              ? "image/png"
              : ext === ".gif"
                ? "image/gif"
                : ext === ".webp"
                  ? "image/webp"
                  : "image/jpeg",
        };
      }
    }
  } catch {
    /* fallthrough */
  }
  return { bytes: PLACEHOLDER_PNG, filename: "thumb.png", contentType: "image/png" };
}

async function uploadThumb(
  accessToken: string,
  cover: { bytes: Uint8Array; filename: string; contentType: string },
): Promise<string> {
  const blob = new Blob([Buffer.from(cover.bytes)], { type: cover.contentType });
  const form = new FormData();
  form.append("media", blob, cover.filename);
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=thumb`;
  const res = await fetch(url, { method: "POST", body: form });
  const data: any = await res.json();
  if (!data?.media_id) {
    const form2 = new FormData();
    form2.append("media", new Blob([Buffer.from(cover.bytes)], { type: cover.contentType }), cover.filename);
    const url2 = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=thumb`;
    const res2 = await fetch(url2, { method: "POST", body: form2 });
    const data2: any = await res2.json();
    if (!data2?.thumb_media_id && !data2?.media_id) {
      throw new Error(data2?.errmsg || data?.errmsg || "上传封面图失败");
    }
    return (data2.thumb_media_id || data2.media_id) as string;
  }
  return data.media_id as string;
}

async function resolveWechatPayload(articleName: string): Promise<{ title: string; html: string; digest: string }> {
  const name = path.basename(articleName);

  // 直接指定 html
  if (/\.html$/i.test(name)) {
    const raw = await readArticle(name);
    const m = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = m ? m[1].replace(/<[^>]+>/g, "").trim() : name.replace(/\.html$/i, "");
    return { title, html: raw, digest: title.slice(0, 54) };
  }

  // IR 包或 slug：优先 *.wechat.html
  const slug = name.replace(/\.json$/i, "");
  try {
    const { ir } = await readArticleIR(`${slug}.json`);
    let html: string;
    try {
      html = await readArticle(`${slug}.wechat.html`);
    } catch {
      // 兼容旧单文件 html
      html = await readArticle(`${slug}.html`);
    }
    return { title: ir.title, html, digest: (ir.digest || ir.title).slice(0, 54) };
  } catch {
    /* fallthrough */
  }

  const raw = await readArticle(name);
  const baseTitle = name.replace(/\.(html|md|markdown|txt)$/i, "");
  if (/\.html$/i.test(name)) {
    const m = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = m ? m[1].replace(/<[^>]+>/g, "").trim() : baseTitle;
    return { title, html: raw, digest: title.slice(0, 54) };
  }
  const lines = raw.split(/\r?\n/);
  let title = baseTitle;
  let body = raw;
  if (lines[0]?.startsWith("# ")) {
    title = lines[0].slice(2).trim();
    body = lines.slice(1).join("\n").trim();
  }
  const html = body
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  return { title, html, digest: title.slice(0, 54) };
}

export const wechatPublisher: Publisher = {
  id: "wechat",
  name: "微信公众号",
  implemented: true,
  async publish(articleName: string): Promise<PublishResult> {
    const settings = await readSettings();
    const { appid, appsecret, author } = settings.wechat;
    if (!appid || !appsecret) {
      return { ok: false, platform: "wechat", message: "请先填写微信 AppID / AppSecret" };
    }
    try {
      const { title, html, digest } = await resolveWechatPayload(articleName);
      const token = await getAccessToken(appid, appsecret);
      const cover = await loadCoverBytes(articleName);
      const thumb = await uploadThumb(token, cover);
      const payload = {
        articles: [
          {
            title: title.slice(0, 64),
            author: author || "",
            digest: digest.slice(0, 54),
            content: html,
            content_source_url: "",
            thumb_media_id: thumb,
            need_open_comment: 0,
            only_fans_can_comment: 0,
          },
        ],
      };
      const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (data?.errcode && data.errcode !== 0) {
        throw new Error(data.errmsg || `errcode ${data.errcode}`);
      }
      const mediaId = data?.media_id as string | undefined;
      await appendPublishRecord({
        platform: "wechat",
        article: articleName,
        title,
        mediaId,
        ok: true,
      });
      return {
        ok: true,
        platform: "wechat",
        message: mediaId ? `已写入草稿箱（media_id=${mediaId}）` : "已提交草稿",
        mediaId,
      };
    } catch (e: any) {
      await appendPublishRecord({
        platform: "wechat",
        article: articleName,
        ok: false,
        error: e?.message || String(e),
      });
      return { ok: false, platform: "wechat", message: e?.message || String(e) };
    }
  },
};

export const xiaohongshuPublisher: Publisher = {
  id: "xiaohongshu",
  name: "小红书",
  implemented: false,
  async publish(): Promise<PublishResult> {
    return {
      ok: false,
      platform: "xiaohongshu",
      message: "小红书暂不支持一键发布；请在文章管理中导出 *.xhs.txt 手动粘贴",
    };
  },
};

export const zhihuPublisher: Publisher = {
  id: "zhihu",
  name: "知乎",
  implemented: false,
  async publish(): Promise<PublishResult> {
    return { ok: false, platform: "zhihu", message: "知乎发布尚未接入" };
  },
};

export const PUBLISHERS: Publisher[] = [wechatPublisher, xiaohongshuPublisher, zhihuPublisher];

const pubById = new Map(PUBLISHERS.map((p) => [p.id, p]));

export function listPublishers() {
  return PUBLISHERS.map((p) => ({ id: p.id, name: p.name, implemented: p.implemented }));
}

export async function publishArticle(platform: string, articleName: string): Promise<PublishResult> {
  const p = pubById.get(platform);
  if (!p) {
    return { ok: false, platform, message: `未知平台：${platform}` };
  }
  return p.publish(articleName);
}
