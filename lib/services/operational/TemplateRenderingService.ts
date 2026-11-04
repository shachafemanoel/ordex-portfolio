export type TemplateRenderContext = Record<string, string | number | null | undefined>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replace `{{key}}` placeholders; unknown keys left unchanged. */
export function renderTemplateString(template: string, ctx: TemplateRenderContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = ctx[key];
    if (v === undefined || v === null) return '';
    return String(v);
  });
}

export function plainTextToHtmlParagraphs(text: string): string {
  const escaped = escapeHtml(text);
  const parts = escaped.split(/\r?\n/).map((line) => line.trim());
  return `<div style="font-family: sans-serif; direction: rtl; text-align: right;">${parts
    .map((p) => (p ? `<p>${p}</p>` : '<br/>'))
    .join('')}</div>`;
}

export class TemplateRenderingService {
  renderBody(content: string, ctx: TemplateRenderContext): { text: string; html: string } {
    const text = renderTemplateString(content, ctx);
    const html = plainTextToHtmlParagraphs(text);
    return { text, html };
  }

  renderSubject(subject: string | null | undefined, ctx: TemplateRenderContext): string {
    const base = subject?.trim() || '(ללא נושא)';
    return renderTemplateString(base, ctx);
  }
}
