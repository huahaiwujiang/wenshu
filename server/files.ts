import fs from "node:fs/promises";
import path from "node:path";
import type { ArticleIR, PlatformId } from "./content/ir.js";
import {
  ARTICLES_DIR,
  DATA_DIR,
  DEFAULT_SETTINGS,
  OUTPUT_DIR,
  PUBLISH_RECORDS_PATH,
  SETTINGS_PATH,
  TEMPLATES_DIR,
  WECHAT_IMAGES_DIR,
  type Settings,
} from "./paths.js";

export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(ARTICLES_DIR, { recursive: true });
  await fs.mkdir(WECHAT_IMAGES_DIR, { recursive: true });
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  try {
    await fs.access(SETTINGS_PATH);
  } catch {
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
  }
  try {
    await fs.access(PUBLISH_RECORDS_PATH);
  } catch {
    await fs.writeFile(PUBLISH_RECORDS_PATH, "[]", "utf-8");
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof (base as any)[k] === "object") {
      (out as any)[k] = deepMerge((base as any)[k], v as any);
    } else if (v !== undefined) {
      (out as any)[k] = v;
    }
  }
  return out;
}

export async function readSettings(): Promise<Settings> {
  await ensureDataDirs();
  const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<Settings>;
  return deepMerge(DEFAULT_SETTINGS, parsed);
}

export async function writeSettings(next: Partial<Settings>): Promise<Settings> {
  await ensureDataDirs();
  const existing = await readSettings();
  const merged = deepMerge(existing, next);
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function safeFileName(title: string): string {
  return (
    title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "untitled"
  );
}

export type ArticleListItem = {
  name: string;
  title: string;
  format: string;
  size: number;
  mtime: string;
  /** 是否为 IR 包（slug.json） */
  isPackage?: boolean;
  slug?: string;
  platforms?: string[];
  variants?: string[];
};

export async function listArticles(): Promise<ArticleListItem[]> {
  await ensureDataDirs();
  const files = await fs.readdir(ARTICLES_DIR);
  const items: ArticleListItem[] = [];
  const packageSlugs = new Set<string>();

  for (const name of files) {
    if (!/\.json$/i.test(name)) continue;
    const full = path.join(ARTICLES_DIR, name);
    const st = await fs.stat(full);
    if (!st.isFile()) continue;
    try {
      const ir = JSON.parse(await fs.readFile(full, "utf-8")) as ArticleIR;
      if (ir?.schemaVersion !== 1 || !ir.title) continue;
      const slug = name.replace(/\.json$/i, "");
      packageSlugs.add(slug);
      const variants = files.filter(
        (f) => f.startsWith(`${slug}.`) && !/\.json$/i.test(f) && /\.(html|md|markdown|txt)$/i.test(f),
      );
      items.push({
        name,
        title: ir.title,
        format: "ir",
        size: st.size,
        mtime: st.mtime.toISOString(),
        isPackage: true,
        slug,
        platforms: ir.meta?.platforms || [],
        variants,
      });
    } catch {
      /* 非 IR json 忽略 */
    }
  }

  for (const name of files) {
    if (!/\.(html|md|markdown|txt)$/i.test(name)) continue;
    // 已归属某 IR 包的变体不单独列为主条目
    const belong = [...packageSlugs].some((slug) => name.startsWith(`${slug}.`));
    if (belong) continue;
    const full = path.join(ARTICLES_DIR, name);
    const st = await fs.stat(full);
    if (!st.isFile()) continue;
    const ext = path.extname(name).slice(1).toLowerCase();
    const format = ext === "markdown" ? "md" : ext;
    items.push({
      name,
      title: name.replace(/\.(html|md|markdown|txt)$/i, ""),
      format,
      size: st.size,
      mtime: st.mtime.toISOString(),
    });
  }

  items.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
  return items;
}

export async function readArticle(name: string): Promise<string> {
  const full = resolveArticlePath(name);
  return fs.readFile(full, "utf-8");
}

export async function readArticleIR(nameOrSlug: string): Promise<{ slug: string; ir: ArticleIR }> {
  const base = path.basename(nameOrSlug).replace(/\.json$/i, "");
  const full = resolveArticlePath(`${base}.json`);
  const ir = JSON.parse(await fs.readFile(full, "utf-8")) as ArticleIR;
  if (ir?.schemaVersion !== 1) throw new Error("不是有效的文章 IR");
  return { slug: base, ir };
}

export async function writeArticleContent(name: string, content: string): Promise<void> {
  const full = resolveArticlePath(name);
  await fs.writeFile(full, content, "utf-8");
}

export function slugFromArticleIrPath(irFile: string): string | undefined {
  const resolved = path.resolve(irFile);
  const articlesDir = path.resolve(ARTICLES_DIR);
  if (resolved !== articlesDir && !resolved.startsWith(articlesDir + path.sep)) return undefined;
  const base = path.basename(resolved);
  if (!/\.json$/i.test(base)) return undefined;
  return base.replace(/\.json$/i, "");
}

export async function writeArticlePackage(
  ir: ArticleIR,
  variants: Array<{ platform: PlatformId; filename: string; content: string }>,
  options?: { slug?: string },
): Promise<{ slug: string; irFile: string; variants: string[] }> {
  await ensureDataDirs();
  let slug: string;
  if (options?.slug) {
    slug = options.slug;
  } else {
    let base = safeFileName(ir.title);
    slug = base;
    let i = 1;
    while (true) {
      try {
        await fs.access(path.join(ARTICLES_DIR, `${slug}.json`));
        slug = `${base}-${i}`;
        i += 1;
      } catch {
        break;
      }
    }
  }

  const irFile = `${slug}.json`;
  const variantNames: string[] = [];
  for (const v of variants) {
    const filename = `${slug}.${v.filename}`;
    await fs.writeFile(path.join(ARTICLES_DIR, filename), v.content, "utf-8");
    variantNames.push(filename);
  }
  ir.meta.platforms = variants.map((v) => v.platform);
  await fs.writeFile(path.join(ARTICLES_DIR, irFile), JSON.stringify(ir, null, 2), "utf-8");
  return { slug, irFile, variants: variantNames };
}

/** 兼容旧调用：单文件写入 */
export async function writeArticle(
  title: string,
  content: string,
  format: "html" | "markdown" | "md" | "txt",
): Promise<string> {
  await ensureDataDirs();
  const ext = format === "html" ? "html" : format === "txt" ? "txt" : "md";
  let base = safeFileName(title);
  let filename = `${base}.${ext}`;
  let full = path.join(ARTICLES_DIR, filename);
  let i = 1;
  while (true) {
    try {
      await fs.access(full);
      filename = `${base}-${i}.${ext}`;
      full = path.join(ARTICLES_DIR, filename);
      i += 1;
    } catch {
      break;
    }
  }
  await fs.writeFile(full, content, "utf-8");
  return filename;
}

export async function deleteArticle(name: string): Promise<void> {
  const base = path.basename(name);
  if (base !== name || base.includes("..")) throw new Error("非法文件名");

  // 删 IR 包时级联删变体
  if (/\.json$/i.test(base)) {
    const slug = base.replace(/\.json$/i, "");
    const files = await fs.readdir(ARTICLES_DIR);
    for (const f of files) {
      if (f === base || f.startsWith(`${slug}.`)) {
        await fs.unlink(path.join(ARTICLES_DIR, f)).catch(() => undefined);
      }
    }
    return;
  }
  await fs.unlink(resolveArticlePath(name));
}

function resolveArticlePath(name: string): string {
  const base = path.basename(name);
  if (base !== name || base.includes("..")) {
    throw new Error("非法文件名");
  }
  return path.join(ARTICLES_DIR, base);
}

export async function listTemplates(): Promise<Array<{ name: string; id: string; size: number; mtime: string }>> {
  await ensureDataDirs();
  const files = await fs.readdir(TEMPLATES_DIR);
  const items = [];
  for (const name of files) {
    if (!/\.html$/i.test(name)) continue;
    const full = path.join(TEMPLATES_DIR, name);
    const st = await fs.stat(full);
    if (!st.isFile()) continue;
    items.push({
      name,
      id: name.replace(/\.html$/i, ""),
      size: st.size,
      mtime: st.mtime.toISOString(),
    });
  }
  items.sort((a, b) => a.id.localeCompare(b.id, "zh"));
  return items;
}

export async function readTemplate(idOrName: string): Promise<{ id: string; name: string; content: string }> {
  const name = idOrName.endsWith(".html") ? path.basename(idOrName) : `${path.basename(idOrName)}.html`;
  if (name.includes("..")) throw new Error("非法模板名");
  const full = path.join(TEMPLATES_DIR, name);
  const content = await fs.readFile(full, "utf-8");
  return { id: name.replace(/\.html$/i, ""), name, content };
}

export async function writeTemplate(id: string, content: string): Promise<string> {
  await ensureDataDirs();
  const safe = safeFileName(id).replace(/\s+/g, "-");
  const name = `${safe}.html`;
  await fs.writeFile(path.join(TEMPLATES_DIR, name), content, "utf-8");
  return name;
}

export async function deleteTemplate(idOrName: string): Promise<void> {
  const name = idOrName.endsWith(".html") ? path.basename(idOrName) : `${path.basename(idOrName)}.html`;
  if (name.includes("..")) throw new Error("非法模板名");
  await fs.unlink(path.join(TEMPLATES_DIR, name));
}

export function applyTemplate(
  templateHtml: string,
  title: string,
  bodyHtml: string,
  extras?: { digest?: string },
): string {
  let out = templateHtml.replaceAll("{{title}}", title).replaceAll("{{content}}", bodyHtml);
  if (extras?.digest != null) {
    out = out.replaceAll("{{digest}}", extras.digest);
  }
  return out;
}

export async function appendPublishRecord(record: Record<string, unknown>): Promise<void> {
  await ensureDataDirs();
  let list: unknown[] = [];
  try {
    list = JSON.parse(await fs.readFile(PUBLISH_RECORDS_PATH, "utf-8"));
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.unshift({ ...record, at: new Date().toISOString() });
  await fs.writeFile(PUBLISH_RECORDS_PATH, JSON.stringify(list.slice(0, 200), null, 2), "utf-8");
}

export { ARTICLES_DIR, DATA_DIR, OUTPUT_DIR, TEMPLATES_DIR, WECHAT_IMAGES_DIR };
