import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArticleIR, stripFence } from "./ir.js";
import { renderPlatform } from "./renderers.js";

const FALLBACK = { topic: "测试话题", createdAt: "2026-01-01T00:00:00.000Z" };

describe("parseArticleIR", () => {
  it("parses minimal valid JSON", () => {
    const ir = parseArticleIR(
      JSON.stringify({
        title: "标题",
        topic: "测试话题",
        digest: "摘要",
        tags: ["a"],
        hooks: { opening: "开头", closing: "结尾" },
        sections: [{ heading: "一", paragraphs: ["段落一", "段落二"] }],
      }),
      FALLBACK,
    );
    assert.equal(ir.title, "标题");
    assert.equal(ir.sections.length, 1);
    assert.equal(ir.schemaVersion, 1);
  });

  it("truncates digest to 54 chars", () => {
    const long = "字".repeat(80);
    const ir = parseArticleIR(
      JSON.stringify({
        title: "标题",
        digest: long,
        sections: [{ heading: "一", paragraphs: ["p"] }],
      }),
      FALLBACK,
    );
    assert.equal(ir.digest.length, 54);
  });

  it("strips markdown fences", () => {
    const raw = '```json\n{"title":"T","sections":[{"heading":"h","paragraphs":["p"]}]}\n```';
    const ir = parseArticleIR(raw, FALLBACK);
    assert.equal(ir.title, "T");
  });
});

describe("stripFence", () => {
  it("removes json code fence", () => {
    assert.equal(stripFence("```json\n{}\n```"), "{}");
  });
});

describe("renderPlatform", () => {
  it("renders wechat html with xhs filename suffix for xiaohongshu", () => {
    const ir = parseArticleIR(
      JSON.stringify({
        title: "渲染测试",
        digest: "摘要",
        sections: [{ heading: "节", paragraphs: ["正文"] }],
        xhsBeats: ["a", "b", "c"],
        scriptBeats: ["镜头1"],
      }),
      FALLBACK,
    );
    const wechat = renderPlatform("wechat", ir);
    assert.match(wechat.content, /<html/i);
    assert.equal(wechat.filenameSuffix, "wechat");

    const xhs = renderPlatform("xiaohongshu", ir);
    assert.equal(xhs.filenameSuffix, "xhs");
    assert.match(xhs.content, /渲染测试/);
  });
});
