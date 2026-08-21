import fs from "node:fs/promises";
import path from "node:path";
import { WECHAT_IMAGES_DIR } from "../paths.js";
import type { ArticleIR } from "./ir.js";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

async function listLocalImages(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string) {
    let names: string[];
    try {
      names = await fs.readdir(d);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(d, name);
      let st;
      try {
        st = await fs.stat(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) await walk(full);
      else if (IMAGE_EXTS.has(path.extname(name).toLowerCase())) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

export type CoverMode = "local" | "picsum" | "none";

export type CoverResult = {
  mode: CoverMode;
  /** 本地绝对路径；picsum 时为空 */
  filePath?: string;
  /** 远程图 URL（picsum） */
  url?: string;
  bytes?: Uint8Array;
  contentType?: string;
};

/** 为文章挑选封面：优先本地 wechat-images，其次 picsum */
export async function resolveCover(ir: ArticleIR, mode: CoverMode): Promise<CoverResult | null> {
  if (mode === "none") return null;

  if (mode === "local" || mode === "picsum") {
    const locals = await listLocalImages(WECHAT_IMAGES_DIR);
    if (locals.length) {
      const seed = Math.abs(hash(ir.title + ir.topic)) % locals.length;
      const filePath = locals[seed];
      const bytes = new Uint8Array(await fs.readFile(filePath));
      const ext = path.extname(filePath).toLowerCase();
      const contentType =
        ext === ".png"
          ? "image/png"
          : ext === ".gif"
            ? "image/gif"
            : ext === ".webp"
              ? "image/webp"
              : "image/jpeg";
      return { mode: "local", filePath, bytes, contentType };
    }
  }

  if (mode === "picsum" || mode === "local") {
    const seed = encodeURIComponent(ir.title.slice(0, 40) || "wenshu");
    const url = `https://picsum.photos/seed/${seed}/900/500`;
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`picsum ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      return {
        mode: "picsum",
        url: res.url || url,
        bytes: buf,
        contentType: res.headers.get("content-type") || "image/jpeg",
      };
    } catch {
      return null;
    }
  }

  return null;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
