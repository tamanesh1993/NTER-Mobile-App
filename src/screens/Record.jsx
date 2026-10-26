// One record: its fields, the AI brief nter.pro keeps for it, and what to do next — ask the AI,
// make a document with Quick Exit, download, pin, or watch its module.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/app.jsx';
import { useChat } from '../state/chat.jsx';
import { useStudio } from '../state/studio.jsx';
import { api, isSample } from '../services/index.js';
import { hostOf, normalizeBrief, recordAttachment, rowFields, rowLink, rowTitle, timeAgo } from '../services/shape.js';
import { exportRecordPdf } from '../lib/exporters.js';
import { openUrl } from '../lib/open.js';
import Icon from '../ui/Icon.jsx';
import { Header, MiniIris, TabBar, fmtDate } from '../ui/kit.jsx';
import { rowKeyOf, rowStage } from './Module.jsx';

const DATE_KEYS = ['date_introduced', 'date', 'published_at', 'decision_date', 'filed_on', 'as_of', 'updated', 'year'];

function useBrief(module, row, signedIn) {
  const [state, setState] = useState({ phase: 'idle', brief: null, error: '' });
  const timer = useRef(null);
  const load = async (generate = false, tries = 0) => {
    setState((s) => ({ ...s, phase: generate || tries ? 'writing' : 'loading', error: '' }));
    try {
      const r = await api.recordBrief({ module, row, generate });
      if (r.state === 'ready') setState({ phase: 'ready', brief: normalizeBrief(r), error: '' });
      else if (r.state === 'pending' && tries < 15) timer.current = setTimeout(() => load(false, tries + 1), 4000);
      else if (r.state === 'missing') setState({ phase: 'missing', brief: null, error: '' });
      else setState({ phase: 'unavailable', brief: null, error: r.state === 'failed' ? 'The brief could not be written this time.' : 'Briefs are not available for this module.' });
    } catch (e) {
      setState({ phase: 'error', brief: null, error: e.status === 401 ? 'Sign in to read the AI brief.' : e.message });
    }
  };
  useEffect(() => {
    if (signedIn || isSample) load(false);
    else setState({ phase: 'guest', brief: null, error: '' });
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.feature, signedIn]);
  return [state, load];
}

export default function RecordScreen({ module, row }) {
  const { openSheet, pins, togglePin, watchlist, toggleWatch, toast, signedIn, requireSignIn } = useApp();
  const chat = useChat();
  const { openChat } = useStudio();
  const title = rowTitle(row, module.title);
  const fields = rowFields(row);
  const stage = rowStage(row);
  const link = rowLink(row);
  const key = rowKeyOf(module, row);
  const pinned = pins.some((p) => p.key === key);
  const watched = watchlist.some((w) => w.tab === module.desk && w.feature === module.feature);
  const [brief, loadBrief] = useBrief(module, row, signedIn);
  const dateKey = DATE_KEYS.find((k) => row[k]);
  const chips = ['house', 'bill_type', 'type', 'bill_category', 'category', 'sector', 'ministry', 'court', 'state', 'country'].map((k) => row[k]).filter((v) => typeof v === 'string' && v && v.length < 40).slice(0, 4);

  const asAttachment = () => ({ ...recordAttachment({ row, module }), key, label: title, icon: 'doc', record: { module, row, title, key } });
  const ask = () => {
    chat.attach(asAttachment());
    chat.setDeskContext({ tier: module.desk, feature: module.feature });
    openChat();
  };
  const quickExit = () => openSheet('qe', { record: { module, row, title, key } });
  const download = async () => {
    try { await exportRecordPdf({ module, row, title, brief: brief.brief }); } catch (e) { toast(e.message || 'Could not make the PDF'); }
  };

  return (
    <div className="view push">
      <Header back line title={module.title} sub={`RECORD · ${(module.deskName || module.desk || '').toUpperCase()}`}
        right={<button type="button" className="qxb" onClick={quickExit} aria-label="Quick Exit documents"><MiniIris /></button>} />
      <div className="body">
        <div className="rec-top">
          <h2>{title}</h2>
          <div className="chips">
            {chips.map((c) => <span key={c} className="stg">{c}</span>)}
            {stage ? <span className={`stg ${/pend|lapse/i.test(stage) ? 'warn' : 'ok'}`}>{stage}</span> : null}
          </div>
          {link ? <button type="button" className="src" onClick={() => openUrl(link)}><Icon name="ext" />Source · {hostOf(link)}</button> : null}
        </div>

        <div className="numhd">01 · AT A GLANCE</div>
        <div className="glance">
          {stage ? <div className="g"><span>STAGE</span><b className={/pend|lapse/i.test(stage) ? 'warn' : 'ok'}>{stage}</b><small>as recorded</small></div> : null}
          {dateKey ? <div className="g"><span>{dateKey.replace(/_/g, ' ').toUpperCase()}</span><b>{fmtDate(row[dateKey]) || String(row[dateKey])}</b><small>{module.title}</small></div> : null}
          {!stage && !dateKey ? fields.slice(1, 3).map((f) => <div key={f.key} className="g"><span>{f.label.toUpperCase()}</span><b>{f.value.slice(0, 40)}</b></div>) : null}
        </div>

        <div className="numhd">02 · ABOUT THIS RECORD</div>
        <div className="brief">
          <div className="bk"><span style={{ color: 'var(--accent)' }}>✦</span>NIYANTRAN ANALYSIS · AI BRIEF{brief.brief?.writtenAt ? ` · WRITTEN ${timeAgo(brief.brief.writtenAt).toUpperCase()}` : ''}</div>
          {brief.phase === 'ready' && brief.brief ? (
            <>
              <p>{brief.brief.lead}</p>
              {brief.brief.points.length ? <ul>{brief.brief.points.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
              {brief.brief.why ? <div className="sub"><b>WHY IT MATTERS</b><p>{brief.brief.why}</p></div> : null}
              {brief.brief.watch ? <div className="sub"><b>WATCH FOR</b><p>{brief.brief.watch}</p></div> : null}
              {brief.brief.tags.length ? <div className="chips" style={{ marginTop: 8 }}>{brief.brief.tags.map((t) => <span key={t} className="stg">{t}</span>)}</div> : null}
            </>
          ) : null}
          {brief.phase === 'loading' ? <p className="muted">Looking for the brief…</p> : null}
          {brief.phase === 'writing' ? <p className="muted">Writing the brief from this record… this takes a few seconds.</p> : null}
          {brief.phase === 'missing' ? (
            <><p className="muted">No brief has been written for this record yet. Writing one is free and reads only the record itself.</p>
              <button type="button" className="pbtn sm soft" onClick={() => loadBrief(true)}><Icon name="sparkle" />Write the AI brief</button></>
          ) : null}
          {brief.phase === 'guest' ? (
            <><p className="muted">Sign in to read the AI brief nter.pro keeps for this record.</p>
              <button type="button" className="pbtn sm soft" onClick={() => requireSignIn('Sign in to read AI briefs and ask the AI.')}>Sign in</button></>
          ) : null}
          {['error', 'unavailable'].includes(brief.phase) ? <p className="muted">{brief.error}</p> : null}
        </div>

        <div className="fields">
          {fields.map((f) => <FragmentField key={f.key} label={f.label} value={f.value} />)}
        </div>

        <div style={{ padding: '14px 16px 0' }}>
          <button type="button" className="pbtn" onClick={ask}><Icon name="sparkle" />Ask AI about this record</button>
        </div>
        <div className="prov">
          {module.title.toUpperCase()} · {(module.deskName || '').toUpperCase()} DESK{link ? ` · ${hostOf(link).toUpperCase()}` : ''}
          <br />Fields are shown as the source publishes them. Information, not advice.
        </div>
      </div>
      <div className="actbar">
        <button type="button" className="pbtn dark" onClick={quickExit}><MiniIris size={22} />Quick Exit</button>
        <button type="button" className="ib" onClick={download} aria-label="Download as PDF"><Icon name="download" /></button>
        <button type="button" className={`ib ${pinned ? 'on' : ''}`} aria-pressed={pinned} onClick={() => { togglePin({ key, title, module, row }); toast(pinned ? 'Unpinned' : 'Pinned to your library'); }} aria-label="Pin"><Icon name="pin" /></button>
        <button type="button" className={`ib ${watched ? 'on' : ''}`} aria-pressed={watched} onClick={() => toggleWatch({ tab: module.desk, feature: module.feature, label: module.title })} aria-label="Watch this module"><Icon name="bell" /></button>
      </div>
      <TabBar />
    </div>
  );
}

function FragmentField({ label, value }) {
  const long = value.length > 160;
  const [open, setOpen] = useState(false);
  return (
    <>
      <span>{label}</span>
      <b>
        {/^https:\/\//.test(value) ? <button type="button" className="linkbtn" onClick={() => openUrl(value)}>{hostOf(value) || 'Open link'}</button> : (long && !open ? `${value.slice(0, 160)}…` : value)}
        {long ? <button type="button" className="linkbtn" style={{ marginLeft: 6, fontSize: 12 }} onClick={() => setOpen((o) => !o)}>{open ? 'less' : 'more'}</button> : null}
      </b>
    </>
  );
}
