import { applyTemplate } from "../files.js";
import { plainBodyFromIR, type ArticleIR, type PlatformId } from "./ir.js";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 微信友好：section + 内联样式，无 absolute / 外部 CSS */
export function renderWechatHtml(ir: ArticleIR, templateHtml?: string): string {
  const parts: string[] = [];
  if (ir.hooks.opening) {
    parts.push(
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#374151;">${escapeHtml(ir.hooks.opening)}</p>`,
    );
  }
  for (const sec of ir.sections) {
    if (sec.heading) {
      parts.push(
        `<h2 style="margin:22px 0 10px;font-size:18px;font-weight:700;color:#111827;border-left:3px solid #2563eb;padding-left:10px;">${escapeHtml(sec.heading)}</h2>`,
      );
    }
    for (const p of sec.paragraphs) {
      parts.push(`<p style="margin:0 0 14px;font-size:16px;line-height:1.85;color:#374151;">${escapeHtml(p)}</p>`);
    }
  }
  if (ir.hooks.closing) {
    parts.push(
      `<p style="margin:18px 0 0;font-size:15px;line-height:1.8;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:14px;">${escapeHtml(ir.hooks.closing)}</p>`,
    );
  }
  if (ir.tags.length) {
    parts.push(
      `<p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">${ir.tags.map((t) => `#${escapeHtml(t)}`).join(" ")}</p>`,
    );
  }

  const body = parts.join("\n");
  if (templateHtml) {
    return applyTemplate(templateHtml, ir.title, body, { digest: ir.digest });
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(ir.title)}</title></head>
<body>
<section style="max-width:680px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#fff;color:#1f2937;">
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.35;">${escapeHtml(ir.title)}</h1>
  <p style="margin:0 0 18px;font-size:13px;color:#9ca3af;">${escapeHtml(ir.digest)}</p>
  ${body}
</section>
</body></html>`;
}

export function renderXiaohongshu(ir: ArticleIR): string {
  const beats =
    ir.xhsBeats?.length && ir.xhsBeats.length >= 3
      ? ir.xhsBeats
      : [
          ir.hooks.opening || ir.digest,
          ...ir.sections.flatMap((s) => [s.heading ? `【${s.heading}】` : "", ...s.paragraphs]).filter(Boolean),
          ir.hooks.closing,
        ].filter(Boolean);

  const lines = [`${ir.title}`, ""];
  beats.slice(0, 12).forEach((b, i) => {
    const emoji = ["✨", "📌", "💡", "🔥", "✅", "📎"][i % 6];
    lines.push(`${emoji} ${b}`);
    lines.push("");
  });
  if (ir.tags.length) {
    lines.push(ir.tags.map((t) => `#${t}`).join(" "));
  }
  return lines.join("\n").trim() + "\n";
}

export function renderScript(ir: ArticleIR): string {
  const beats =
    ir.scriptBeats?.length && ir.scriptBeats.length >= 2
      ? ir.scriptBeats
      : [
          `钩子：${ir.hooks.opening || ir.digest}`,
          ...ir.sections.map((s, i) => `段落${i + 1}${s.heading ? `「${s.heading}」` : ""}：${s.paragraphs.join(" ")}`),
          `收尾：${ir.hooks.closing || "点个关注，下期继续拆。"}`,
        ];

  const lines = [
    `【口播标题】${ir.title}`,
    `【一句话卖点】${ir.digest}`,
    "",
    "—— 分镜口播 ——",
    "",
  ];
  beats.forEach((b, i) => {
    lines.push(`[镜头 ${i + 1}]`);
    lines.push(b);
    lines.push("");
  });
  if (ir.tags.length) {
    lines.push(`标签：${ir.tags.join(" / ")}`);
  }
  return lines.join("\n").trim() + "\n";
}

export function renderMarkdown(ir: ArticleIR): string {
  const lines = [`# ${ir.title}`, "", `> ${ir.digest}`, ""];
  if (ir.hooks.opening) {
    lines.push(ir.hooks.opening, "");
  }
  for (const sec of ir.sections) {
    if (sec.heading) lines.push(`## ${sec.heading}`, "");
    for (const p of sec.paragraphs) lines.push(p, "");
  }
  if (ir.hooks.closing) lines.push("---", "", ir.hooks.closing, "");
  if (ir.tags.length) lines.push(ir.tags.map((t) => `\`${t}\``).join(" "), "");
  return lines.join("\n").trim() + "\n";
}

export function renderTxt(ir: ArticleIR): string {
  return `${ir.title}\n\n${ir.digest}\n\n${plainBodyFromIR(ir)}\n`;
}

export function renderPlatform(
  platform: PlatformId,
  ir: ArticleIR,
  options?: { templateHtml?: string },
): { content: string; ext: string; filenameSuffix: string } {
  switch (platform) {
    case "wechat":
      return { content: renderWechatHtml(ir, options?.templateHtml), ext: "html", filenameSuffix: "wechat" };
    case "xiaohongshu":
      return { content: renderXiaohongshu(ir), ext: "txt", filenameSuffix: "xhs" };
    case "script":
      return { content: renderScript(ir), ext: "txt", filenameSuffix: "script" };
    case "markdown":
      return { content: renderMarkdown(ir), ext: "md", filenameSuffix: "md" };
    case "txt":
      return { content: renderTxt(ir), ext: "txt", filenameSuffix: "txt" };
    default:
      throw new Error(`未知平台：${platform}`);
  }
}

/** 设置里的 format → 额外需要落地的 raw 格式平台 */
export function formatToPlatform(format: "html" | "markdown" | "txt"): PlatformId | null {
  if (format === "markdown") return "markdown";
  if (format === "txt") return "txt";
  return null; // html 由 wechat 平台承担
}
