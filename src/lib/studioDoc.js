// Studio documents: an answer or a Quick Exit document turned into editable blocks, with the
// gap markers ([NOT IN RECORD → …], [FROM INSTRUMENT TEXT → …], [you: …]) drawn as marks.
import { splitCitationMarkers } from './citationMarkers.js';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MARK_RE = /\[NOT IN RECORD[^\]]*\]|\[FROM (?:INSTRUMENT|BILL) TEXT[^\]]*\]|\[(?:AUTHORITY|CITATION|FACT|SCHOLARSHIP|DOCUMENT|ANNEXURE) NEEDED[^\]]*\]|\[(?:you|lawyer|instructions|user)[^\]]*\]/g;
export function markKind(t) {
  if (/^\[FROM/.test(t)) return 'txt';
  if (/^\[(NOT IN RECORD|[A-Z]+ NEEDED)/.test(t)) return 'non';
  return 'you';
}

// One line of text → safe HTML with emphasis, citation numbers and gap marks.
export function inlineHtml(text) {
  let out = '';
  let last = 0;
  const s = String(text || '');
  for (const m of s.matchAll(MARK_RE)) {
    out += inlineEmphasis(s.slice(last, m.index));
    out += `<mark class="mk ${markKind(m[0])}">${escapeHtml(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + inlineEmphasis(s.slice(last));
}
function inlineEmphasis(t) {
  return splitCitationMarkers(t).map((p) => (typeof p === 'string'
    ? escapeHtml(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '$1')
    : `<sup>[${p.citation}]</sup>`)).join('');
}

// Markdown → blocks: each heading starts a block (its label); lists and paragraphs become HTML.
export function markdownToBlocks(md, firstLabel = '') {
  const blocks = [];
  let cur = { lab: firstLabel, lines: [] };
  for (const raw of String(md || '').replace(/\r\n/g, '\n').split('\n')) {
    const h = /^#{1,6}\s+(.*)$/.exec(raw) || /^\*\*([^*]{2,60})\*\*:?\s*$/.exec(raw.trim());
    if (h) {
      if (cur.lines.some((l) => l.trim()) || cur.lab) blocks.push(cur);
      cur = { lab: h[1].replace(/[*:]+$/g, '').trim(), lines: [] };
    } else cur.lines.push(raw);
  }
  if (cur.lines.some((l) => l.trim()) || cur.lab) blocks.push(cur);
  return blocks.map((b) => ({ lab: b.lab, html: linesToHtml(b.lines) })).filter((b) => b.html || b.lab);
}

function linesToHtml(lines) {
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const l of lines) {
    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(l);
    if (item) {
      const tag = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (!list || list.tag !== tag) { flush(); list = { tag, items: [] }; }
      list.items.push(item[2]);
      continue;
    }
    flush();
    if (l.trim() && !/^\s*(-{3,}|\*{3,})\s*$/.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l)) out.push(`<p>${inlineHtml(l.trim().replace(/^\|/, '').replace(/\|$/, '').replace(/\s*\|\s*/g, ' · '))}</p>`);
  }
  flush();
  return out.join('');
}

export function sourcesHtml(sources = [], webSources = []) {
  const rows = [];
  for (const s of sources) {
    if (!s) continue;
    const where = s.kind === 'row' ? `${s.feature || ''} · register row` : [s.file_name, s.page_number ? `p. ${s.page_number}` : ''].filter(Boolean).join(' · ');
    rows.push(`<li>[${escapeHtml(s.id)}] ${escapeHtml(s.title || '')}${where ? ` — ${escapeHtml(where)}` : ''}</li>`);
  }
  for (const w of webSources) if (w?.url) rows.push(`<li>${escapeHtml(w.title || w.url)} — ${escapeHtml(w.url)}</li>`);
  return rows.length ? `<ul>${rows.join('')}</ul>` : '';
}

const uid = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export function docFromAnswer(turn) {
  const blocks = markdownToBlocks(turn.text, 'ANSWER');
  const src = sourcesHtml(turn.sources, turn.webSources);
  if (src) blocks.push({ lab: 'SOURCES', html: src });
  return {
    id: uid(), kind: 'answer', name: turn.question.slice(0, 80) || 'AI answer', title: turn.question.slice(0, 120) || 'AI answer',
    rec: turn.attachments?.[0] || 'Research answer', fmt: 'DOCX', layout: 'NTER answer', asof: today(), when: new Date().toISOString(),
    blocks, stamps: `Answer by ${turn.model?.label || turn.model?.served || turn.requested?.model || 'nter.pro AI'} · ${today()}`, notEst: 'Anything the answer marks as not established.',
  };
}

export function docFromQuickExit({ qe, persona, record, text, answer, fmt, sample }) {
  const blocks = markdownToBlocks(text, 'DOCUMENT');
  if (answer && blocks.length) blocks[0].html += `<p><mark class="mk you">[you said: ${escapeHtml(answer)}]</mark></p>`;
  return {
    id: uid(), kind: 'quickexit', qeId: qe.id, name: qe.name, title: `${qe.name} · ${record.title}`.slice(0, 160),
    rec: record.title, persona: persona.name, bucket: qe.bucket, fmt: fmt || qe.default || 'PDF', layout: qe.name, asof: today(), when: new Date().toISOString(),
    blocks, stamps: `${record.module.title} · ${record.module.deskName || record.module.desk} desk · as of ${today()}`,
    notEst: `Every marked slot above. ${qe.gate || ''}`.trim(), sample: Boolean(sample),
  };
}

export function blankDoc() {
  return {
    id: uid(), kind: 'blank', name: 'Untitled document', title: 'Untitled document', rec: 'No record', fmt: 'DOCX', layout: 'NTER document', asof: today(), when: new Date().toISOString(),
    blocks: [{ lab: 'HEADING', html: '<p>Start writing…</p>' }, { lab: 'BODY', html: '<p></p>' }], stamps: '', notEst: '',
  };
}

// Plain text of a document's blocks (for copy and export).
export function blocksToText(blocks) {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  return blocks.map((b) => {
    let t = b.html;
    if (div) {
      div.innerHTML = b.html.replace(/<li>/g, '<li>• ').replace(/<\/(p|li|ul|ol)>/g, '$&\n');
      t = div.textContent;
    } else t = t.replace(/<[^>]+>/g, '');
    return `${b.lab ? `${b.lab}\n` : ''}${t.trim()}`;
  }).join('\n\n');
}

// What Studio keeps from an edited block: text and a few formatting tags; every attribute except
// a mark's class is dropped, so pasted content can never carry script or remote images.
const ALLOWED = new Set(['P', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'MARK', 'SUP', 'DIV', 'SPAN']);
export function sanitizeHtml(html) {
  if (typeof DOMParser === 'undefined') return escapeHtml(String(html || '').replace(/<[^>]+>/g, ''));
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1) { child.remove(); continue; }
      if (!ALLOWED.has(child.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'LINK', 'META'].includes(child.tagName)) { child.remove(); continue; }
        walk(child);
        child.replaceWith(...child.childNodes);
        continue;
      }
      const cls = child.tagName === 'MARK' ? child.getAttribute('class') : null;
      for (const a of [...child.attributes]) child.removeAttribute(a.name);
      if (cls && /^mk (txt|non|you|ok|att)$/.test(cls)) child.setAttribute('class', cls);
      walk(child);
    }
  };
  const root = doc.body.firstChild;
  walk(root);
  return root.innerHTML;
}
