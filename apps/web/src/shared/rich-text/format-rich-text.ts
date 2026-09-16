/** Escapes HTML, then applies a small markdown-like subset. No WYSIWYG / raw HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function formatRichTextToHtml(source: string): string {
  const escaped = escapeHtml(source ?? "");
  const withLinks = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, rawUrl: string) => {
    const url = rawUrl.trim();
    if (!isSafeHttpUrl(url)) {
      return `${label} (${url})`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  const withCode = withLinks.replace(/`([^`]+)`/g, "<code>$1</code>");
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  const withBullets = withItalic.replace(/^[\t ]*[-*] (.+)$/gm, "• $1");
  return withBullets.replace(/\n/g, "<br/>");
}
