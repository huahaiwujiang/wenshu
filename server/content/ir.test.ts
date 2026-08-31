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

  it("keeps long titles unchanged", () => {
    const longTitle = "字".repeat(30);
    const ir = parseArticleIR(
      JSON.stringify({
        title: longTitle,
        sections: [{ heading: "一", paragraphs: ["p"] }],
      }),
      FALLBACK,
    );
    assert.equal(ir.title.length, 30);
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

    const carousel = renderPlatform("carousel", ir);
    assert.equal(carousel.filenameSuffix, "carousel");
    assert.match(carousel.content, /渲染测试/);
  });

  it("carousel omits image markers and keeps only a short caption per slide", () => {
    const ir = parseArticleIR(
      JSON.stringify({
        title: "贴图测试",
        digest: "一句话摘要",
        hooks: {
          opening: "Alpha 版又迭代了，这次会话体验是主线，后面还有很多细节可以慢慢展开给读者看。",
          closing: "升级前建议备份。https://example.com/r",
        },
        sections: [
          {
            heading: "新增：会话与子代理",
            paragraphs: [
              "【配图：a.png】",
              "会话体验是这版主线。",
              "第二句补充：ACP 与 Windows x64 SDK 也在这版补齐，配文不应再输出。",
            ],
          },
        ],
        tags: ["tag1"],
      }),
      FALLBACK,
    );
    const out = renderPlatform("carousel", ir).content;
    assert.doesNotMatch(out, /【配图/);
    assert.match(out, /新增：会话与子代理/);
    assert.match(out, /会话体验是这版主线/);
    assert.doesNotMatch(out, /ACP 与 Windows x64 SDK/);
    assert.doesNotMatch(out, /给读者看/);
    assert.match(out, /…/);
    assert.match(out, /升级前建议备份/);
    assert.match(out, /https:\/\/example\.com\/r/);
  });
});
