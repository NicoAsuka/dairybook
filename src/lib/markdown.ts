import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

// Allow all URLs through to the renderer so we can sanitize them there
md.validateLink = () => true;

const defaultLinkOpen = md.renderer.rules.link_open ??
  ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const t = tokens[idx];
  const hrefIdx = t.attrIndex("href");
  if (hrefIdx >= 0) {
    const href = t.attrs![hrefIdx]![1].toLowerCase().trim();
    if (href.startsWith("javascript:") || href.startsWith("data:") || href.startsWith("vbscript:")) {
      t.attrs![hrefIdx]![1] = "#";
    }
  }
  t.attrSet("target", "_blank");
  t.attrSet("rel", "noopener noreferrer");
  return defaultLinkOpen(tokens, idx, opts, env, self);
};

export function renderMarkdown(text: string): string {
  if (!text) return "";
  return md.render(text);
}
