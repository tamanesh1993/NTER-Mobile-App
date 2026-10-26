// Every bottom sheet in the app, opened with openSheet(name, props).
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/app.jsx';
import { useChat, FOCUS, EFFORT_LABEL } from '../state/chat.jsx';
import { useStudio } from '../state/studio.jsx';
import { api } from '../services/index.js';
import { planAllows, recordAttachment, timeAgo, rowTitle } from '../services/shape.js';
import { PERSONAS } from '../data/personas.js';
import { PLANS, rupees, PLAN_RANK } from '../data/plans.js';
import { DESKS, ALL_MODULES, deskById, deskImg } from '../data/desks.js';
import { fileToAttachment } from '../lib/files.js';
import { openUrl } from '../lib/open.js';
import { isNative } from '../lib/platform.js';
import Icon from '../ui/Icon.jsx';
import { SheetShell, SheetHead, Ph, Spinner, Empty, fmtNum } from '../ui/kit.jsx';
import QuickExitSheet from './QuickExit.jsx';

function Picker() {
  const { pins, closeSheet, toast, push } = useApp();
  const chat = useChat();
  const { setSeg } = useStudio();
  const [tab, setTab] = useState(pins.length ? 'pinned' : 'search');
  const [q, setQ] = useState('');
  const [found, setFound] = useState({ rows: [], loading: false, error: '' });
  const [sel, setSel] = useState([]);
  const [reading, setReading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (tab !== 'search' || q.trim().length < 3) { setFound({ rows: [], loading: false, error: '' }); return undefined; }
    const ctrl = new AbortController();
    setFound((f) => ({ ...f, loading: true }));
    const t = setTimeout(() => api.searchRecords(q, { signal: ctrl.signal })
      .then((rows) => !ctrl.signal.aborted && setFound({ rows, loading: false, error: '' }))
      .catch((e) => !ctrl.signal.aborted && setFound({ rows: [], loading: false, error: e.message || 'Search is unavailable.' })), 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, tab]);

  const toggle = (item) => setSel((s) => (s.some((x) => x.key === item.key) ? s.filter((x) => x.key !== item.key) : [...s, item]));
  const asItem = (module, row) => {
    const title = rowTitle(row, module.title);
    return { ...recordAttachment({ row, module }), key: `${module.tier}::${module.feature}::${title}`, label: title, icon: 'doc', record: { module, row, title, key: `${module.tier}::${module.feature}::${title}` } };
  };
  const attachAll = () => { sel.forEach((it) => chat.attach(it)); toast(`Attached ${sel.length}`); closeSheet(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReading(true);
    try { const att = await fileToAttachment(file); chat.attach(att); toast(`Attached ${file.name}${att.note ? ` (${att.note})` : ''}`); closeSheet(); } catch (err) { toast(err.message); } finally { setReading(false); }
  };
  const row = (item, meta) => {
    const on = sel.some((s) => s.key === item.key);
    return (
      <button key={item.key} type="button" className={`rrow ${on ? 'on' : ''}`} onClick={() => toggle(item)} aria-pressed={on}>
        <span className="ico"><Icon name="doc" /></span>
        <span className="tx"><b>{item.label}</b><span>{meta}</span></span>
        <span className="chk">{on ? <Icon name="check" /> : null}</span>
      </button>
    );
  };

  return (
    <SheetShell size="tall" label="Attach">
      <SheetHead title="Attach to your question" sub="Records from any desk, or a file from your phone" />
      <div className="tabs">
        {[['pinned', 'Pinned'], ['search', 'Search'], ['files', 'Files']].map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'search' ? <div className="search" style={{ margin: '0 16px 10px' }}><Icon name="search" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bills, questions, orders, releases…" aria-label="Search records" /></div> : null}
      <div className="sh-body" style={{ padding: 0 }}>
        {tab === 'pinned' ? (
          <div className="list">
            {pins.map((p) => row(asItem(p.module, p.row), `${p.module.title} · pinned`))}
            {!pins.length ? <Empty title="Nothing pinned yet">Pin records from their pages, or search for one.</Empty> : null}
          </div>
        ) : null}
        {tab === 'search' ? (
          <div className="list">
            {found.loading ? <Spinner /> : null}
            {found.error ? <div className="note-strip">{found.error}</div> : null}
            {found.rows.map((r) => {
              const module = ALL_MODULES.find((m) => m.desk === r.desk && m.feature === r.feature) || { tier: r.tier, feature: r.feature, title: r.feature, desk: r.desk };
              return row(asItem(module, r.row), r.feature);
            })}
            {q.trim().length < 3 ? <Empty title="Find a record">Type three letters or more. Or browse the desks and use the clip on any record.</Empty> : null}
          </div>
        ) : null}
        {tab === 'files' ? (
          <>
            <div className="upl" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}><Icon name="upload" />{reading ? 'Reading…' : 'PDF or text file'}</button>
              <button type="button" onClick={() => { closeSheet(); setSeg('desk'); }}><Icon name="library" />Browse the desks</button>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.tsv,.json,application/pdf,text/*" hidden onChange={onFile} />
            <p className="note-line" style={{ padding: '0 16px' }}>The text is read on your phone and sent with your question (up to about 40,000 characters). Scanned PDFs without text cannot be read here.</p>
          </>
        ) : null}
      </div>
      {tab !== 'files' ? (
        <div className="sh-foot">
          <button type="button" className="pbtn" disabled={!sel.length} onClick={attachAll}>Attach {sel.length || ''} to your question</button>
          <button type="button" className="linkbtn" style={{ display: 'block', margin: '10px auto 0', fontSize: 12.5 }} onClick={() => { closeSheet(); push({ v: 'search' }); }}>Open full search</button>
        </div>
      ) : null}
    </SheetShell>
  );
}

function Focus() {
  const { closeSheet } = useApp();
  const chat = useChat();
  return (
    <SheetShell size="mid" label="Focus">
      <SheetHead title="Focus" sub="What the answer is allowed to read" />
      <div className="sh-body">
        {FOCUS.map((f) => (
          <button key={f.id} type="button" className={`opt ${chat.focus === f.id ? 'on' : ''}`} onClick={() => chat.setFocus(f.id)} aria-pressed={chat.focus === f.id}>
            <span className="tx"><b>{f.label}</b><span>{f.hint}</span></span><span className="radio" />
          </button>
        ))}
        <div className="credit"><span>NARROWER FOCUS · FEWER CREDITS</span><span>BROAD READS MORE</span></div>
      </div>
      <div className="sh-foot"><button type="button" className="pbtn sm" onClick={closeSheet}>Done</button></div>
    </SheetShell>
  );
}

function Model() {
  const { models, plan, credits, openSheet, signedIn } = useApp();
  const chat = useChat();
  return (
    <SheetShell size="tall" label="Model">
      <SheetHead title="Model" sub="Fast models on Free; every model from Plus" />
      <div className="sh-body">
        {!models.length ? <Spinner label="Loading models" /> : null}
        {models.map((m) => {
          const ok = planAllows(plan, m.min_plan);
          const on = chat.model?.model_id === m.model_id;
          return (
            <button key={m.model_id} type="button" className={`opt ${on ? 'on' : ''} ${ok ? '' : 'dis'}`} aria-pressed={on}
              onClick={() => (ok ? chat.setModelId(m.model_id) : openSheet('plans'))}>
              <span className="tx"><b>{m.label}</b><span>{m.vendor ? `${m.vendor[0].toUpperCase()}${m.vendor.slice(1)}` : ''}{m.credits ? ` · ≈${fmtNum(m.credits)} credits an answer` : ''}</span></span>
              {!ok ? <span className="tag">{String(m.min_plan || 'plus').toUpperCase()}</span> : null}
              <span className="radio" />
            </button>
          );
        })}
        <button type="button" className="opt dis" disabled><span className="tx"><b>Niyantran AI</b><span>Our own research model. Coming soon on Pro.</span></span><span className="tag">SOON</span></button>
        <div className="k" style={{ margin: '10px 0 6px' }}>REASONING EFFORT</div>
        <div className="segs">
          {chat.efforts.map((e) => <button key={e} type="button" className={chat.effort === e ? 'on' : ''} onClick={() => chat.setEffort(e)} aria-pressed={chat.effort === e}>{EFFORT_LABEL[e] || e}</button>)}
        </div>
        <div className="credit">
          <span>MORE EFFORT · SLOWER, MORE CREDITS</span>
          {signedIn && credits ? <span>{fmtNum(credits.available)} LEFT</span> : null}
        </div>
      </div>
    </SheetShell>
  );
}

function PersonaPick() {
  const { personaDb, choosePersona, closeSheet } = useApp();
  return (
    <SheetShell size="tall" label="Perspective">
      <SheetHead title="Switch perspective" sub="Changes Quick Exits, starters and answer style" />
      <div className="sh-body">
        {PERSONAS.map((p) => (
          <button key={p.id} type="button" className={`opt ${personaDb === p.db ? 'on' : ''}`} onClick={async () => { await choosePersona(p); closeSheet(); }} aria-pressed={personaDb === p.db}>
            <span className="ic"><Icon name={p.icon} /></span><span className="tx"><b>{p.name}</b><span>{p.tag}</span></span><span className="radio" />
          </button>
        ))}
      </div>
    </SheetShell>
  );
}

function Source({ source }) {
  const { push, closeSheet, toast } = useApp();
  const chat = useChat();
  const isRow = source.kind === 'row';
  const module = isRow ? (ALL_MODULES.find((m) => (m.desk === source.tier || m.tier === source.tier) && m.feature === source.feature) || null) : null;
  const snap = source.row_snapshot || {};
  return (
    <SheetShell size="tall" label={`Source ${source.id}`}>
      <SheetHead title={`Source ${source.id}`} sub={isRow ? `${source.feature} · register row` : [source.file_name, source.page_number ? `p. ${source.page_number}` : ''].filter(Boolean).join(' · ') || 'Document'} />
      <div className="sh-body">
        <div className="docpage">
          <div className="hd"><span>{isRow ? String(source.feature || '').toUpperCase() : 'DOCUMENT'}</span><span>{source.snapshot_at ? `as of ${timeAgo(source.snapshot_at)}` : ''}</span></div>
          <b>{source.title}</b>
          {isRow ? <div style={{ marginTop: 8 }}>{Object.entries(snap).slice(0, 30).map(([k, v]) => <div key={k}><span className="muted">{k.replace(/_/g, ' ')}:</span> {v}</div>)}</div> : null}
          {!isRow && source.section?.heading ? <div style={{ marginTop: 8 }}><mark>{source.section.heading}</mark></div> : null}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 2px 0', lineHeight: 1.45 }}>{isRow ? 'This is the row the answer cited, as it stood when cited.' : 'The answer cited this passage of the document. Open it on nter.pro to read the page.'}</p>
      </div>
      <div className="sh-foot" style={{ display: 'flex', gap: 8 }}>
        {isRow && module ? <button type="button" className="pbtn sm" onClick={() => { closeSheet(); push({ v: 'record', module, row: snap }); }}>Open record</button> : null}
        {isRow && module ? <button type="button" className="pbtn sm sec" onClick={() => { chat.attach({ ...recordAttachment({ row: snap, module }), key: `${module.tier}::${module.feature}::${source.title}`, label: source.title, icon: 'doc', record: { module, row: snap, title: source.title } }); toast('Attached'); closeSheet(); }}>Attach</button> : null}
        {!isRow && /^https:\/\//.test(source.file_url || '') ? <button type="button" className="pbtn sm" onClick={() => openUrl(source.file_url)}>Open document</button> : null}
        {!isRow && !/^https:\/\//.test(source.file_url || '') ? <button type="button" className="pbtn sm sec" onClick={() => openUrl('https://www.nter.pro')}>Open nter.pro</button> : null}
      </div>
    </SheetShell>
  );
}

// In the phone apps, plans are bought on the website only (app-store rules on outside payment
// links), so the native sheet shows the plans without a checkout button.
function Plans() {
  const { plan, signedIn, toast } = useApp();
  const native = isNative();
  const [pick, setPick] = useState(plan === 'free' ? 'pro' : plan);
  const p = PLANS.find((x) => x.id === pick);
  const go = () => {
    if (pick === plan) { toast(`You are on ${p.name}`); return; }
    openUrl(api.pricingUrl());
  };
  return (
    <SheetShell size="tall" label="Plans">
      <SheetHead title="Plans" sub="Billed monthly in ₹ · same plans as nter.pro" />
      <div className="sh-body">
        {PLANS.map((x) => (
          <button key={x.id} type="button" className={`plancard ${pick === x.id ? 'on' : ''}`} onClick={() => setPick(x.id)} aria-pressed={pick === x.id}>
            {x.popular ? <span className="pill accent tag">MOST POPULAR</span> : plan === x.id && signedIn ? <span className="pill live tag">CURRENT</span> : null}
            <b>{x.name}</b>
            <span className="pr">{x.monthly ? rupees(x.monthly) : '₹0'}<small>{x.monthly ? ' / month' : ''}</small></span>
            <span>{x.line}</span>
          </button>
        ))}
        <p className="note-line">{native ? 'Plans are managed in your nter.pro account. A plan you hold there works here straight away.' : 'Plans are bought and managed on nter.pro, with Razorpay. Your plan and credits then work here straight away.'}</p>
      </div>
      {!native ? (
        <div className="sh-foot">
          <button type="button" className="pbtn" onClick={go}>{pick === plan ? `You are on ${p.name}` : PLAN_RANK[pick] > PLAN_RANK[plan] ? `Continue with ${p.name} on nter.pro` : 'Change plan on nter.pro'}</button>
        </div>
      ) : null}
    </SheetShell>
  );
}

function Writing() {
  const { writing, setWriting, closeSheet } = useApp();
  const sel = (k, label, opts) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
      {label}
      <select className="sel" value={writing[k]} onChange={(e) => setWriting({ ...writing, [k]: e.target.value })}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
    </label>
  );
  return (
    <SheetShell size="tall" label="Writing profile">
      <SheetHead title="Writing profile" sub="Goes into the IDENTITY line of every document" />
      <div className="sh-body">
        {sel('aud', 'Writing for', ['Principal / MP office', 'Newsroom desk', 'Self (GS-II)', 'Board / leadership', 'Senior / client', 'Journal / seminar', 'Policy brief readers'])}
        {sel('lang', 'Language', ['English', 'Hindi', 'Hinglish'])}
        {sel('cite', 'Citation style', ['None', 'SCC + neutral citation', 'Chicago 17', 'APA 7', 'OSCOLA'])}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
          Organisation
          <input className="sel" value={writing.org || ''} onChange={(e) => setWriting({ ...writing, org: e.target.value.slice(0, 80) })} placeholder="Optional" />
        </label>
      </div>
      <div className="sh-foot"><button type="button" className="pbtn sm" onClick={closeSheet}>Done</button></div>
    </SheetShell>
  );
}

function History() {
  const { closeSheet, signedIn, toast, go } = useApp();
  const chat = useChat();
  const { setSeg } = useStudio();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const load = () => api.listConversations().then(setList).catch((e) => { setList([]); toast(e.message); });
  useEffect(() => { if (signedIn) load(); else setList([]); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);
  const open = async (c) => { await chat.loadConversation(c); setSeg('chat'); go('ask'); };
  const rename = async (c, title) => { try { await api.renameConversation(c.id, title); setEditing(null); load(); } catch (e) { toast(e.message); } };
  const remove = async (c) => { try { await api.deleteConversation(c.id); setConfirm(null); if (chat.conversationId === c.id) chat.newChat(); load(); } catch (e) { toast(e.message); } };
  return (
    <SheetShell drawer label="Your research">
      <div style={{ height: 'calc(12px + var(--safe-top))' }} />
      <div className="sh-hd" style={{ paddingTop: 0 }}><div className="t"><b>Research</b><span>Your conversations, newest first</span></div><button type="button" className="ib" onClick={closeSheet} aria-label="Close"><Icon name="close" /></button></div>
      <div style={{ padding: '0 16px 10px' }}><button type="button" className="pbtn sm soft" onClick={() => { chat.newChat(); setSeg('chat'); go('ask'); }}><Icon name="newchat" />New research</button></div>
      <div className="sh-body">
        {list === null ? <Spinner /> : null}
        {list && !list.length ? <Empty title={signedIn ? 'No conversations yet' : 'Sign in to see your research'}>{signedIn ? 'Questions you ask here and on nter.pro appear in this list.' : 'Your conversations are saved to your nter.pro account.'}</Empty> : null}
        {(list || []).map((c) => (
          <div key={c.id} className={`thread ${chat.conversationId === c.id ? 'on' : ''}`}>
            {editing === c.id ? (
              <form onSubmit={(e) => { e.preventDefault(); rename(c, new FormData(e.currentTarget).get('t')); }} style={{ display: 'flex', gap: 6 }}>
                <input name="t" defaultValue={c.title || ''} maxLength={80} className="sel" style={{ flex: 1 }} autoFocus />
                <button type="submit" className="linkbtn">Save</button>
              </form>
            ) : (
              <button type="button" style={{ textAlign: 'left' }} onClick={() => open(c)}><b>{c.title || 'Untitled'}</b></button>
            )}
            <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {timeAgo(c.last_message_at || c.created_at).toUpperCase()}
              <button type="button" className="linkbtn" style={{ fontFamily: 'var(--sans)', fontSize: 11 }} onClick={() => setEditing(editing === c.id ? null : c.id)}>Rename</button>
              {confirm === c.id
                ? <button type="button" className="linkbtn" style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--red)' }} onClick={() => remove(c)}>Confirm delete</button>
                : <button type="button" className="linkbtn" style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--muted)' }} onClick={() => setConfirm(c.id)}>Delete</button>}
            </span>
          </div>
        ))}
      </div>
    </SheetShell>
  );
}

function Watchlist() {
  const { watchlist, setWatchlist, push, closeSheet, signedIn } = useApp();
  return (
    <SheetShell size="mid" label="Watchlist">
      <SheetHead title="Watchlist" sub={signedIn ? 'Modules you follow · same list as on nter.pro' : 'Modules you follow on this phone'} />
      <div className="sh-body">
        {watchlist.map((w) => {
          const m = ALL_MODULES.find((x) => x.desk === w.tab && x.feature === w.feature);
          return (
            <div key={`${w.tab}:${w.feature}`} className="alert" style={{ alignItems: 'center' }}>
              <span className="dt" />
              <button type="button" style={{ flex: 1, textAlign: 'left' }} onClick={() => { if (m) { closeSheet(); push({ v: 'module', module: m }); } }}>
                <b>{w.label || w.feature}</b><span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{deskById(w.tab)?.name || w.tab} desk</span>
              </button>
              <button type="button" className="ib" style={{ width: 34, height: 34, color: 'var(--muted)' }} onClick={() => setWatchlist(watchlist.filter((x) => x !== w))} aria-label={`Stop watching ${w.label || w.feature}`}><Icon name="close" /></button>
            </div>
          );
        })}
        {!watchlist.length ? <Empty title="Nothing watched">Tap the bell on any module or record to follow it.</Empty> : null}
      </div>
    </SheetShell>
  );
}

function DeskPick({ current }) {
  const { replaceTop, closeSheet } = useApp();
  return (
    <SheetShell size="tall" label="Choose a desk">
      <div className="grab" />
      <div className="sh-hd">
        <div className="t"><div className="k accent">YOUR INTELLIGENCE WORKSPACE</div><b style={{ fontSize: 20 }}>A world of context.<br /><span style={{ color: 'var(--accent)' }}>Choose your perspective.</span></b></div>
        <button type="button" className="ib" onClick={closeSheet} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="sh-body"><div className="deskpick">
        {DESKS.map((d) => (
          <button key={d.id} type="button" className={`dp ${current === d.id ? 'on' : ''}`} onClick={() => { closeSheet(); replaceTop({ v: 'desk', deskId: d.id }); }}>
            <Ph src={deskImg(d.image)} /><div className="fade" /><div><b>{d.name}</b><small>EXPLORE DESK</small></div>
          </button>
        ))}
      </div></div>
    </SheetShell>
  );
}

function SectorPick({ deskId, index }) {
  const { replaceTop, closeSheet } = useApp();
  const d = deskById(deskId);
  return (
    <SheetShell size="mid" label="Choose a sector">
      <SheetHead title="Select a sector" sub={`${d.name} desk · ${d.groups.length} sectors`} />
      <div className="sh-body">
        {d.groups.map((g, i) => (
          <button key={g.id} type="button" className={`opt ${index === i ? 'on' : ''}`} onClick={() => { closeSheet(); replaceTop({ v: 'sector', deskId, index: i }); }}>
            <span className="tx"><b>{g.name}</b><span>{g.cardDescription || g.description} · {g.modules.length} modules</span></span><span className="radio" />
          </button>
        ))}
      </div>
    </SheetShell>
  );
}

function SignInPrompt({ why }) {
  const { setStage, closeSheet } = useApp();
  return (
    <SheetShell size="mid" label="Sign in">
      <SheetHead title="Sign in to continue" sub="Same account as nter.pro" />
      <div className="sh-body">
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: '4px 0 14px' }}>{why}</p>
        <p className="note-line">New accounts start on Free with 10,000 AI credits for 30 days.</p>
      </div>
      <div className="sh-foot" style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="pbtn" onClick={() => { closeSheet(); setStage('signin'); }}>Sign in</button>
        <button type="button" className="pbtn sec" onClick={() => { closeSheet(); setStage('signup'); }}>Create account</button>
      </div>
    </SheetShell>
  );
}

const SHEETS = { picker: Picker, focus: Focus, model: Model, personaPick: PersonaPick, source: Source, plans: Plans, writing: Writing, history: History, watchlist: Watchlist, deskPick: DeskPick, sectorPick: SectorPick, signinPrompt: SignInPrompt, qe: QuickExitSheet };

export default function SheetHost() {
  const { sheet } = useApp();
  if (!sheet) return null;
  const S = SHEETS[sheet.k];
  return S ? <S key={sheet.k} {...sheet} /> : null;
}
