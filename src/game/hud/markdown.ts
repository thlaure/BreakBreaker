const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline: `code`, [text](http(s) url), **bold**. Input is escaped first, so nothing from the source becomes markup. */
function inline(raw: string): string {
  let t = esc(raw);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return t;
}

/** Minimal markdown (headings, bullet lists, paragraphs, inline code/links/bold) to safe HTML. No library. */
export function renderMarkdown(md: string): string {
  const out: string[] = [];
  let list = false;
  let para: string[] = [];
  const flushPara = (): void => {
    if (para.length) out.push(`<p>${para.map(inline).join(' ')}</p>`);
    para = [];
  };
  const closeList = (): void => {
    if (list) out.push('</ul>');
    list = false;
  };
  for (const line of md.split(/\r?\n/)) {
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      closeList();
      out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`);
    } else if (li) {
      flushPara();
      if (!list) out.push('<ul>');
      list = true;
      out.push(`<li>${inline(li[1]!)}</li>`);
    } else if (line.trim() === '') {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  return out.join('\n');
}
