import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("renders basic markdown", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  it("renders links", () => {
    const html = renderMarkdown("[x](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });

  it("strips raw HTML", () => {
    const html = renderMarkdown('<script>alert(1)</script>hello');
    expect(html).not.toContain("<script");
    expect(html).toContain("hello");
  });

  it("escapes javascript: links", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("returns empty string on empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});
