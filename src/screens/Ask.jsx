// Ask AI: three sections — Library (the desks, to browse and attach), AI chat (preselected) and Studio — with the
// Quick Exit shutter in the top-right corner.
import { useEffect, useRef } from 'react';
import { useApp } from '../state/app.jsx';
import { useChat, FOCUS, EFFORT_LABEL } from '../state/chat.jsx';
import { useStudio } from '../state/studio.jsx';
import { docFromAnswer, blocksToText } from '../lib/studioDoc.js';
import { exportDocument } from '../lib/exporters.js';
import { copyText, shareLink, openUrl } from '../lib/open.js';
import Markdown, { plainText } from '../ui/Markdown.jsx';
import Icon from '../ui/Icon.jsx';
import { MiniIris, TabBar, fmtNum } from '../ui/kit.jsx';
import { DeskGrid } from './Library.jsx';
import StudioBody from './Studio.jsx';
import { QE_DATA } from '../data/quickExit.js';

function AskHeader() {
  const { openSheet } = useApp();
  const { seg, setSeg } = useStudio();
  const chat = useChat();
  const idx = { desk: 0, chat: 1, studio: 2 }[seg];
  const rec = chat.attachments.find((a) => a.record);
  return (
    <div className="askhd">
      <button type="button" className="ib" onClick={() => openSheet('history')} aria-label="Your conversations"><Icon name="history" /></button>
      <div className="segc" role="tablist">
        <div className="ind" style={{ transform: `translateX(${idx * 100}%)` }} />
        {[['desk', 'Library'], ['chat', 'AI chat'], ['studio', 'Studio']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={seg === k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>{l}</button>
        ))}
      </div>
      <button type="button" className={`qxb ${rec ? '' : 'dim'}`} onClick={() => openSheet('qe', { record: rec?.record || null })} aria-label="Quick Exit documents">
        <MiniIris />
      </button>
    </div>
  );
}

function ToolRow() {
  const { openSheet } = useApp();
  const chat = useChat();
  const focus = FOCUS.find((f) => f.id === chat.focus) || FOCUS[0];
  return (
    <div className="toolrow">
      <button type="button" className="setchip" onClick={() => openSheet('focus')}><b>FOCUS</b>{focus.label}<Icon name="down" /></button>
      <button type="button" className={`setchip ${chat.web ? 'on' : ''}`} aria-pressed={chat.web} onClick={() => chat.setWeb(!chat.web)}><Icon name="globe" />Web</button>
      {chat.turns.length ? <button type="button" className="setchip" onClick={chat.newChat}><Icon name="newchat" />New</button> : null}
    </div>
  );
}

function AttRow() {
  const { openSheet } = useApp();
  const chat = useChat();
  return (
    <div className="attrow">
      {chat.attachments.map((a, i) => (
        <span key={a.key || i} className="chip soft" title={a.title}>
          <i style={a.kind === 'record' ? { background: 'var(--purple)' } : a.kind === 'file' ? { background: 'var(--amber)' } : undefined} />
          <span>{a.label || a.title}</span>
          <button type="button" className="x" onClick={() => chat.detach(i)} aria-label={`Remove ${a.title}`}>×</button>
        </span>
      ))}
      <button type="button" className="chip" onClick={() => openSheet('picker')}><Icon name="plus" /><span>{chat.attachments.length ? 'Add' : 'Attach a record or file'}</span></button>
    </div>
  );
}

function Composer() {
  const { openSheet } = useApp();
  const chat = useChat();
  const ta = useRef(null);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [chat.draft]);
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia?.('(pointer:fine)').matches) { e.preventDefault(); chat.send(); } };
  return (
    <div className="compose-wrap">
      <div className="composer">
        <textarea ref={ta} rows={1} value={chat.draft} onChange={(e) => chat.setDraft(e.target.value)} onKeyDown={onKey} maxLength={4000}
          placeholder={chat.attachments.length ? 'Ask about what you attached…' : 'Ask about any record…'} aria-label="Your question" />
        <div className="bar">
          <button type="button" className="ib" onClick={() => openSheet('picker')} aria-label="Attach"><Icon name="clip" /></button>
          <button type="button" className="model" onClick={() => openSheet('model')} aria-label="Model and effort">
            <span className="sp"><Icon name="sparkle" /></span>
            <span className="l">{chat.model?.label || 'Model'}</span>
            <small>· {(EFFORT_LABEL[chat.effort] || chat.effort || '').toUpperCase()}</small>
            <span className="dn"><Icon name="down" /></span>
          </button>
          {chat.busy
            ? <button type="button" className="send stop" onClick={chat.stop} aria-label="Stop"><span className="sq" /></button>
            : <button type="button" className="send" onClick={() => chat.send()} disabled={!chat.draft.trim()} aria-label="Send"><Icon name="send" /></button>}
        </div>
      </div>
    </div>
  );
}

function Empty() {
  const { persona, openSheet } = useApp();
  const chat = useChat();
  const rec = chat.attachments.find((a) => a.record);
  const starters = rec ? [`Explain this record: ${rec.title}`, ...(persona?.starters || []).slice(0, 2)] : (persona?.starters || []);
  const qp = QE_DATA[persona?.qe ?? 0];
  return (
    <>
      {!chat.attachments.length ? (
        <button type="button" className="drop" onClick={() => openSheet('picker')}>
          <Icon name="doc" />Attach a record from a desk — or a file
          <small>Or just ask. Answers cite the records they use.</small>
        </button>
      ) : null}
      <div className="suggest">
        <div className="k">{rec ? 'SUGGESTED FOR THIS RECORD' : `STARTERS FOR ${(persona?.plural || 'RESEARCHERS').toUpperCase()}`}</div>
        {starters.map((s) => <button key={s} type="button" className="sug" onClick={() => chat.send(s)}><Icon name="sparkle" /><span>{s}</span></button>)}
      </div>
      {rec ? (
        <button type="button" className="qehint" onClick={() => openSheet('qe', { record: rec.record })}>
          <MiniIris />
          <span className="tx"><b>{qp.docs.length} documents you can make from this record</b><span>Quick Exit · {qp.name} formats, filled from the record</span></span>
          <Icon name="chev" />
        </button>
      ) : null}
    </>
  );
}

function Activity({ turn }) {
  const items = turn.activity.slice(-4);
  if (turn.status !== 'streaming' || (!items.length && turn.text)) return null;
  return (
    <div className="activity" aria-live="polite">
      {items.length ? items.map((a, i) => <span key={i}>{a.type === 'tool' ? `${a.label || a.name?.replace(/_/g, ' ')}${a.phase === 'end' ? ' — done' : '…'}` : a.text}</span>) : <span>Starting…</span>}
    </div>
  );
}

const ERROR_HELP = {
  no_credits: 'You have no AI credits left to start an answer.',
  insufficient_credits: 'You have no AI credits left to start an answer.',
  model_requires_plan: 'This model needs a paid plan.',
};

export function Answer({ turn, onRerun }) {
  const { openSheet, saveMade, toast } = useApp();
  const { openInStudio } = useStudio();
  const chat = useChat();
  const streaming = turn.status === 'streaming';
  const focusLabel = (FOCUS.find((f) => f.id === turn.focus) || {}).label;
  const modelLabel = turn.model?.label || turn.model?.served || turn.requested?.model || '';
  const used = Number.isFinite(turn.credits) ? turn.credits : null;
  const openSource = (n) => {
    const s = turn.sources.find((x) => x.id === n);
    if (s) openSheet('source', { source: s });
  };
  const studio = () => { const doc = docFromAnswer(turn); saveMade(doc); openInStudio(doc.id); };
  const text = () => `${plainText(turn.text)}${turn.sources.length ? `\n\nSources\n${turn.sources.map((s) => `[${s.id}] ${s.title}`).join('\n')}` : ''}`;
  const exportAs = async (fmt) => {
    try {
      const doc = docFromAnswer(turn);
      await exportDocument({ title: doc.title, subtitle: `nter.pro · ${doc.stamps}`, blocks: doc.blocks, text: blocksToText(doc.blocks), format: fmt });
    } catch (e) { toast(e.message || 'Export failed'); }
  };
  const rec = chat.attachments.find((a) => a.record);
  return (
    <div className="ans">
      <div className="meta">
        <span className="sp"><Icon name="sparkle" /></span>
        {[modelLabel, turn.requested?.effort ? `EFFORT ${String(turn.requested.effort).toUpperCase()}` : '', focusLabel ? `FOCUS ${focusLabel}` : '', turn.requested?.web ? 'WEB' : '', Number.isFinite(used) ? `${fmtNum(used)} CREDITS` : ''].filter(Boolean).join(' · ').toUpperCase()}
      </div>
      <Activity turn={turn} />
      {turn.text ? <div className="body-md"><Markdown text={turn.text} sources={turn.sources} streaming={streaming} onOpenSource={openSource} /></div> : null}
      {streaming && !turn.text ? <div className="body-md"><div className="typing"><i /><i /><i /></div></div> : null}
      {turn.truncated ? <div className="err" style={{ color: 'var(--amber)' }}>The answer reached its length limit. Ask a narrower question to go on.</div> : null}
      {turn.error && turn.status !== 'complete' ? (
        <div className="err" role="alert">
          {ERROR_HELP[turn.errorCode] || turn.error}
          {ERROR_HELP[turn.errorCode] ? <> <button type="button" className="linkbtn" onClick={() => openSheet('plans')}>See plans</button></> : null}
        </div>
      ) : null}
      {turn.sources.length ? (
        <div className="src">
          {turn.sources.map((s) => (
            <button key={s.id} type="button" onClick={() => openSheet('source', { source: s })}>
              <span className="cite">{s.id}</span>
              <span>{s.title}{s.kind === 'row' ? ` · ${s.feature}` : s.file_name ? ` · ${s.file_name}` : ''}{s.page_number ? ` · p. ${s.page_number}` : ''}</span>
            </button>
          ))}
        </div>
      ) : null}
      {turn.webSources.length ? (
        <div className="src">
          <div className="k">WEB PAGES SEARCHED</div>
          {turn.webSources.slice(0, 8).map((w) => (
            <button key={w.url} type="button" onClick={() => openUrl(w.url)}><Icon name="ext" /><span>{w.title || w.url}</span></button>
          ))}
        </div>
      ) : null}
      {!streaming && turn.followUps.length ? (
        <div className="followups">{turn.followUps.map((q) => <button key={q} type="button" onClick={() => chat.send(q)}>{q} →</button>)}</div>
      ) : null}
      {!streaming && turn.text ? (
        <div className="acts">
          <div className="prim">
            <button type="button" className="qe" onClick={() => openSheet('qe', { record: rec?.record || null })}><MiniIris size={20} /><span>Quick Exit</span></button>
            <button type="button" className="stu" onClick={studio}><Icon name="edit" /><span>Open in Studio</span></button>
          </div>
          <div className="more">
            <button type="button" onClick={async () => toast((await copyText(text())) ? 'Copied' : 'Could not copy')}><Icon name="copy" />COPY</button>
            <button type="button" onClick={() => exportAs('PDF')}><Icon name="pdf" />PDF</button>
            <button type="button" onClick={() => exportAs('DOCX')}><Icon name="word" />WORD</button>
            <button type="button" onClick={() => onRerun(turn.question)}><Icon name="rerun" />RE-RUN</button>
            <button type="button" onClick={async () => { const r = await shareLink({ title: turn.question, text: text().slice(0, 3000) }); if (r === 'copied') toast('Copied to share'); }}><Icon name="share" />SHARE</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChatBody() {
  const chat = useChat();
  const { isSample } = useApp();
  const end = useRef(null);
  const last = chat.turns[chat.turns.length - 1];
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [chat.turns.length, last?.text?.length]);
  return (
    <>
      <div className="body" id="chatBody">
        <ToolRow />
        <AttRow />
        {isSample ? <div className="note-strip">Sample build: answers are canned to show the layout. The live app answers with nter.pro’s AI.</div> : null}
        {!chat.turns.length ? <Empty /> : (
          <div className="chat">
            {chat.turns.map((t) => (
              <div key={t.id} style={{ display: 'contents' }}>
                <div className="msg u">{t.question}{t.attachments?.length ? <div className="att">{t.attachments.map((a) => <span key={a}>{String(a).slice(0, 34)}</span>)}</div> : null}</div>
                <Answer turn={t} onRerun={(q) => chat.send(q)} />
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
      </div>
      <Composer />
    </>
  );
}

export default function Ask() {
  const { seg } = useStudio();
  return (
    <div className="view">
      <AskHeader />
      {seg === 'desk' ? <div className="body"><DeskGrid /></div> : seg === 'studio' ? <StudioBody /> : <ChatBody />}
      <TabBar />
    </div>
  );
}
