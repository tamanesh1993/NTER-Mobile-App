// Studio: edit what Quick Exit or an answer made, with every gap still visible. Fill a gap, mark
// it verified or leave it stated; then export to PDF or Word, or copy.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/app.jsx';
import { useStudio } from '../state/studio.jsx';
import { blankDoc, blocksToText, sanitizeHtml } from '../lib/studioDoc.js';
import { exportDocument } from '../lib/exporters.js';
import { copyText } from '../lib/open.js';
import { FORMAT_LABEL } from '../data/quickExit.js';
import Icon from '../ui/Icon.jsx';
import { MiniIris, Empty } from '../ui/kit.jsx';
import { timeAgo } from '../services/shape.js';

const FICON = { PDF: 'pdf', DOCX: 'word', XLSX: 'sheet', PPTX: 'slide', COPY: 'copy', ICS: 'cal', CSV: 'sheet', BIB: 'cite', WA: 'bubble' };

// A block's HTML is handed to the DOM once; typing never re-renders it, so the caret stays put.
const Block = memo(function Block({ html, index, onSave }) {
  return <div className="blk" contentEditable suppressContentEditableWarning data-i={index} onBlur={(e) => onSave(index, e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: html }} />;
}, (a, b) => a.index === b.index);

function countMarks(blocks) {
  let open = 0; let total = 0;
  for (const b of blocks) {
    total += (b.html.match(/<mark /g) || []).length;
    open += (b.html.match(/<mark class="mk (txt|non|att)"/g) || []).length;
  }
  return { open, total };
}

function Editor({ doc }) {
  const { saveMade, toast, persona, writing } = useApp();
  const { setOpenId } = useStudio();
  const [blocks, setBlocks] = useState(doc.blocks);
  const [marks, setMarks] = useState(true);
  const [pop, setPop] = useState(null);
  const [val, setVal] = useState('');
  const paper = useRef(null);
  const markEl = useRef(null);
  const initial = useRef(doc.blocks.map((b) => b.html));

  const readDom = () => {
    const els = paper.current?.querySelectorAll('.blk[data-i]') || [];
    const next = blocks.map((b, i) => ({ ...b, html: els[i] ? sanitizeHtml(els[i].innerHTML) : b.html }));
    setBlocks(next);
    return next;
  };
  const persist = (next = readDom()) => { saveMade({ ...doc, blocks: next, edited: new Date().toISOString() }); return next; };
  const onSave = (i, html) => {
    setBlocks((old) => {
      const next = old.map((b, j) => (j === i ? { ...b, html: sanitizeHtml(html) } : b));
      saveMade({ ...doc, blocks: next, edited: new Date().toISOString() });
      return next;
    });
  };
  const { open, total } = useMemo(() => countMarks(blocks), [blocks]);

  const onPaperClick = (e) => {
    const m = e.target.closest?.('mark');
    if (!m || !paper.current?.contains(m)) return;
    markEl.current = m;
    setVal('');
    setPop({ kind: m.className.includes('txt') ? 'From the instrument text' : m.className.includes('non') ? 'Not in the record' : 'Your input', text: m.textContent });
  };
  const resolve = (how) => {
    const m = markEl.current;
    if (m && how === 'fill' && val.trim()) { m.className = 'mk ok'; m.textContent = val.trim(); }
    if (m && how === 'verify') m.className = 'mk ok';
    setPop(null); markEl.current = null;
    persist();
  };
  const fmt = (cmd) => { try { document.execCommand(cmd, false, null); } catch { /* unsupported */ } };
  const exportAs = async (format) => {
    const next = persist();
    try {
      if (format === 'COPY') { toast((await copyText(blocksToText(next))) ? 'Copied' : 'Could not copy'); return; }
      await exportDocument({ title: doc.title, subtitle: `${doc.rec} · ${persona?.name || ''} · as of ${doc.asof}`, blocks: next, text: blocksToText(next), format, stamps: doc.stamps, notEst: doc.notEst });
    } catch (e) { toast(e.message || 'Export failed'); }
  };

  return (
    <>
      <div className="body" id="studioBody">
        <div className="stu-hd">
          <div className="t"><b>{doc.title}</b><span>{String(doc.rec).toUpperCase()} · {String(doc.layout).toUpperCase()} · DRAFT{doc.sample ? ' · SAMPLE' : ''}</span></div>
          <button type="button" className="ib" onClick={() => { persist(); setOpenId(null); }} aria-label="Close document"><Icon name="close" /></button>
        </div>
        <div className="stu-tools">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('undo')} aria-label="Undo"><Icon name="undo" /></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('bold')} aria-label="Bold"><Icon name="bold" /></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('italic')} aria-label="Italic"><Icon name="italic" /></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('insertUnorderedList')} aria-label="List"><Icon name="list" /></button>
          <span className="sep" />
          <button type="button" className={marks ? 'on' : ''} onClick={() => setMarks((m) => !m)}><Icon name="marker" />Markers</button>
        </div>
        <div className={`paper editing ${marks ? '' : 'nomark'}`} ref={paper} onClick={onPaperClick}>
          <div className="id"><b>IDENTITY</b>{doc.name} · {doc.rec}{persona ? ` · ${persona.name}` : ''}{doc.bucket ? ` · ${doc.bucket}` : ''}<br />Writing for: {writing.aud} · {writing.lang} · as of {doc.asof}</div>
          {blocks.map((b, i) => (
            <div key={i}>
              {b.lab ? <h4>{b.lab}</h4> : null}
              <Block html={initial.current[i] ?? b.html} index={i} onSave={onSave} />
            </div>
          ))}
          {doc.stamps || doc.notEst ? <div className="ft">{doc.stamps ? <><b>STAMPS</b><br />{doc.stamps}<br /></> : null}{doc.notEst ? <><b>NOT ESTABLISHED</b><br />{doc.notEst}</> : null}</div> : null}
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--amber-soft)', border: '1px solid var(--amber)' }} />from bill / instrument text</span>
          <span><i style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }} />not in record → where to get it</span>
          <span><i style={{ background: 'transparent', border: '1px solid var(--muted)' }} />your own input</span>
          <span><i style={{ background: 'var(--live-soft)', border: '1px solid var(--live)' }} />filled or verified by you</span>
        </div>
        {pop ? (
          <div className="pop" role="dialog" aria-label="Resolve this gap">
            <div className="t"><b>{pop.kind}</b>{pop.text}</div>
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Type what goes here…" />
            <div className="row">
              <button type="button" className="p" onClick={() => resolve('fill')} disabled={!val.trim()}>Fill in</button>
              <button type="button" onClick={() => resolve('verify')}>Verified</button>
              <button type="button" onClick={() => resolve('leave')}>Leave as gap</button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="signbar">
        <div className="st">
          <b>{open} open</b><span>of {total} marked slots</span>
          <div className="meter"><i style={{ width: `${total ? Math.round((100 * (total - open)) / total) : 100}%` }} /></div>
          <span className="k">{open ? 'CHECK BEFORE YOU SIGN' : 'READY TO SIGN'}</span>
        </div>
        <div className="row">
          <button type="button" className="pbtn sec" onClick={() => exportAs('PDF')}><Icon name="pdf" />PDF</button>
          <button type="button" className="pbtn sec" onClick={() => exportAs('DOCX')}><Icon name="word" />Word</button>
          <button type="button" className="pbtn sec" onClick={() => exportAs('COPY')}><Icon name="copy" />Copy</button>
          <button type="button" className="pbtn" onClick={() => { persist(); setOpenId(null); toast('Saved to your library'); }}>Done</button>
        </div>
      </div>
    </>
  );
}

export default function StudioBody() {
  const { made, saveMade, openSheet, removeMade } = useApp();
  const { openId, setOpenId } = useStudio();
  const doc = made.find((d) => d.id === openId);
  useEffect(() => { if (openId && !doc) setOpenId(null); }, [openId, doc, setOpenId]);
  if (doc) return <Editor key={doc.id} doc={doc} />;
  return (
    <div className="body">
      <div className="stu-hd"><div className="t"><b>Studio</b><span>EDIT WHAT THE RECORD MADE · FORMATTED, NOT FILED</span></div></div>
      {made.length ? (
        <>
          <div className="numhd">YOUR DRAFTS</div>
          <div className="drafts">
            {made.map((m) => (
              <div key={m.id} className="draft" style={{ display: 'flex', alignItems: 'center' }}>
                <button type="button" style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0, textAlign: 'left', alignItems: 'center' }} onClick={() => setOpenId(m.id)}>
                  <span className="ic"><Icon name={FICON[m.fmt] || 'doc'} /></span>
                  <span className="tx"><b>{m.name}</b><span>{m.rec} · {FORMAT_LABEL[m.fmt] || m.fmt} · {timeAgo(m.edited || m.when)}</span></span>
                </button>
                <button type="button" className="ib" style={{ width: 34, height: 34, color: 'var(--muted)' }} onClick={() => removeMade(m.id)} aria-label={`Delete ${m.name}`}><Icon name="close" /></button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty title="Nothing to edit yet">Studio opens the documents Quick Exit and your answers make, with every gap still visible. Make one from a record.</Empty>
      )}
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="pbtn dark" onClick={() => openSheet('qe', {})}><MiniIris size={22} />Make one with Quick Exit</button>
        <button type="button" className="pbtn sm sec" onClick={() => { const d = blankDoc(); saveMade(d); setOpenId(d.id); }}><Icon name="doc" />Blank NTER document</button>
      </div>
    </div>
  );
}

