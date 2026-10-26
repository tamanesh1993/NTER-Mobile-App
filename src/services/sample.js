// The sample service: a read-only snapshot of nter.pro bundled with the app, for building,
// testing and demos without a network. It never contacts NTER. Sign-in is simulated on the
// device, and AI answers are canned and labelled as such, so nothing here can be mistaken for
// the live product.
import { getJSON, setJSON } from '../lib/storage.js';
import { DESKS, ALL_MODULES } from '../data/desks.js';
import { rowTitle, pickColumns, rowFields, SITE_FIGURES } from './shape.js';
import LATEST from '../sample/home-latest.json';
import MARKETS from '../sample/home-markets.json';
import MODELS from '../sample/ai-models.json';

export const mode = 'sample';

const moduleFiles = import.meta.glob('../sample/modules-*.json', { import: 'default' });
const extraFiles = import.meta.glob(['../sample/feed-store.json', '../sample/record-briefs.json'], { import: 'default' });
const cache = new Map();
const DESK_OF = new Map(ALL_MODULES.map((m) => [`${m.tier}::${m.feature}`, m.desk]));
async function deskModules(deskId) {
  if (cache.has(deskId)) return cache.get(deskId);
  const load = moduleFiles[`../sample/modules-${deskId}.json`];
  const data = load ? await load() : {};
  const store = extraFiles['../sample/feed-store.json'] ? await extraFiles['../sample/feed-store.json']() : {};
  const merged = { ...data };
  for (const [k, v] of Object.entries(store || {})) {
    if (DESK_OF.get(k) === deskId && (!merged[k] || !(merged[k].rows || []).length)) merged[k] = { ...v, desk: deskId };
  }
  cache.set(deskId, merged);
  return merged;
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

// ---------- auth (simulated on this device) ----------
const listeners = new Set();
const SESSION_KEY = 'nter.sample.session';
const PROFILE_KEY = 'nter.sample.profile';
const emit = (s) => listeners.forEach((cb) => cb(s));

export const getSession = () => getJSON(SESSION_KEY, null);
export function onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

async function start(email, profile) {
  const session = { access_token: 'sample', user: { id: 'sample-user', email } };
  await setJSON(SESSION_KEY, session);
  const had = await getJSON(PROFILE_KEY, null);
  await setJSON(PROFILE_KEY, { user_id: 'sample-user', email, status: 'active', persona: null, ...had, ...profile });
  emit(session);
  return session;
}

export async function signIn({ email, password }) {
  if (!/^\S+@\S+\.\S+$/.test(String(email))) throw new Error('Enter a valid email address.');
  if (String(password).length < 6) throw new Error('Email or password is incorrect.');
  return start(email.trim(), {});
}
export async function signUp({ email, password, firstName, lastName, persona }) {
  if (String(password).length < 6) throw new Error('Password should be at least 6 characters.');
  const session = await start(email.trim(), { first_name: firstName, last_name: lastName, name: `${firstName || ''} ${lastName || ''}`.trim(), persona: persona?.db || null });
  return { session, needsConfirmation: false };
}
export const resendConfirmation = async () => {};
export const forgotPassword = async () => {};
export const signInWithGoogle = async () => start('reader@example.com', { first_name: 'Sample', last_name: 'Reader', name: 'Sample Reader' });
export const completeOAuth = async () => null;
export async function signOut() { await setJSON(SESSION_KEY, null); emit(null); }

export async function getProfile() { return getJSON(PROFILE_KEY, null); }
export async function setPersona(db) { const p = (await getProfile()) || {}; await setJSON(PROFILE_KEY, { ...p, persona: db }); }

export async function getEntitlement() { return { plan: 'free', status: 'active', lapsed: false, source: 'sample' }; }
export async function getCredits() {
  const start = new Date(); start.setDate(1);
  const end = new Date(start); end.setDate(start.getDate() + 30);
  return { balance: 10000, held: 0, plan: 'free', cycle: { allowance: 10000, starts_at: start.toISOString(), ends_at: end.toISOString() }, used_this_cycle: 0, recent: [] };
}
export async function getModels() { return MODELS.map((m) => ({ ...m, credits: null })); }

// ---------- news and markets ----------
export async function homeLatest() { return { rows: LATEST.rows, asOf: LATEST.as_of || LATEST.updated || null, fallback: false, sample: true }; }
export async function homeMarkets() { return { rows: MARKETS.rows, asOf: MARKETS.as_of || null, fallback: false, sample: true }; }

export async function siteFigures() { return SITE_FIGURES; }

// ---------- desks ----------
export async function moduleFeed({ module, page = 1, pageSize = 50, q = '' }) {
  const data = await deskModules(module.desk);
  const entry = data[`${module.tier}::${module.feature}`] || null;
  let rows = (entry?.rows || []).filter((r) => r && r.status !== 'source_status');
  const s = String(q || '').trim().toLowerCase();
  if (s) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(s));
  const from = (page - 1) * pageSize;
  return {
    rows: rows.slice(from, from + pageSize),
    columns: pickColumns(rows, entry?.columns),
    total: s ? rows.length : Math.max(rows.length, Number(entry?.total) || 0),
    shown: rows.length,
    paged: false, page, pageSize,
    source: entry?.source || null, coverage: entry?.coverage || null, asOf: null,
    sample: true,
  };
}

export async function searchRecords(query) {
  const s = String(query || '').trim().toLowerCase();
  if (s.length < 3) return [];
  const out = [];
  for (const d of DESKS) {
    const data = await deskModules(d.id);
    for (const entry of Object.values(data)) {
      for (const row of entry.rows || []) {
        if (out.length >= 40) return out;
        if (JSON.stringify(row).toLowerCase().includes(s)) out.push({ desk: d.id, tier: entry.tier, feature: entry.feature, rowKey: null, row, title: rowTitle(row, entry.feature) });
      }
    }
  }
  return out;
}

// ---------- record brief ----------
// The snapshot holds 40 real briefs from nter.pro. One is shown only when it is plainly about the
// record on screen; otherwise the preview says how the live app writes one.
export async function recordBrief({ module, row, generate = false }) {
  const saved = extraFiles['../sample/record-briefs.json'] ? await extraFiles['../sample/record-briefs.json']() : [];
  const title = rowTitle(row, '').toLowerCase();
  const hit = title.length > 3 && Array.isArray(saved)
    ? saved.find((b) => b.feature === module.feature && String(b.headline || '').toLowerCase().includes(title))
    : null;
  if (hit) {
    const p = hit.points || {};
    return Array.isArray(p)
      ? { ok: true, state: 'ready', format: 1, headline: hit.headline, points: p, model: null, writtenAt: hit.written_at, sample: true }
      : { ok: true, state: 'ready', format: 2, brief: hit.headline, why: p.why || '', watch: p.watch || '', tags: p.tags || [], model: null, writtenAt: hit.written_at, sample: true };
  }
  if (!generate) return { ok: true, state: 'missing', sample: true };
  await wait(400);
  const fields = rowFields(row, 8).slice(0, 4);
  return {
    ok: true, state: 'ready', format: 2, sample: true, model: 'sample', writtenAt: new Date().toISOString(),
    brief: `Sample mode: the live app asks nter.pro's AI to write this brief. The record's own fields are ${fields.map((f) => `${f.label.toLowerCase()} “${f.value}”`).join(', ')}.`,
    why: '', watch: '', tags: [module.title],
  };
}

// ---------- research chat (canned, clearly labelled) ----------
const CONV_KEY = 'nter.sample.conversations';

function cannedAnswer(body) {
  const atts = body.attachments || [];
  if (atts.length) {
    const parts = atts.slice(0, 3).map((a, i) => {
      const lines = String(a.text || '').split('\n').filter((l) => l.includes(':')).slice(0, 6);
      return `**${a.title}** [${i + 1}]\n${lines.map((l) => `- ${l.trim()}`).join('\n')}`;
    });
    return `This is a **sample-mode** answer. The preview is not connected to nter.pro’s AI, so it restates what you attached instead of researching it.\n\n${parts.join('\n\n')}\n\nIn the live app the same question is answered by the model you picked, with citations to the desk records and documents it used.`;
  }
  return `This is a **sample-mode** answer. The preview is not connected to nter.pro’s AI.\n\nIn the live app, “${body.message.slice(0, 160)}” is researched across all eight desks — legislation, courts, markets, climate and more — and the answer cites every record it relies on.\n\nTry attaching a record from the Library to see how citations look.`;
}

export async function sendTurn(body, { onFrame, signal } = {}) {
  const convs = await getJSON(CONV_KEY, []);
  let conv = convs.find((c) => c.id === body.conversation_id);
  if (!conv) {
    conv = { id: `sample-${Date.now().toString(36)}`, title: body.message.slice(0, 60), created_at: new Date().toISOString(), messages: [] };
    convs.unshift(conv);
  }
  onFrame?.({ conversation: { id: conv.id } });
  await wait(250, signal);
  onFrame?.({ reasoning: 'Reading the question and what is attached' });
  onFrame?.({ tool: { name: 'search_desk_rows', phase: 'start', step: 1, label: 'Searching desk records' } });
  await wait(400, signal);
  onFrame?.({ tool: { name: 'search_desk_rows', phase: 'end', step: 1, label: 'Searching desk records', count: (body.attachments || []).length } });
  onFrame?.({ model: { served: 'sample', label: 'Sample mode' } });
  const answer = cannedAnswer(body);
  for (const piece of answer.match(/[\s\S]{1,48}/g) || []) {
    onFrame?.({ chunk: piece });
    await wait(18, signal);
  }
  const sources = (body.attachments || []).slice(0, 3).map((a, i) => ({
    id: i + 1, kind: 'row', tier: a.tier || 'national', feature: a.feature || 'Attachment', row_key: `sample-${i + 1}`, title: a.title,
    row_snapshot: Object.fromEntries(String(a.text || '').split('\n').filter((l) => l.includes(':')).slice(0, 12).map((l) => { const j = l.indexOf(':'); return [l.slice(0, j).trim(), l.slice(j + 1).trim()]; })),
    snapshot_at: null,
  }));
  onFrame?.({ sources });
  onFrame?.({ followUpQuestions: ['What changed most recently?', 'Which sources back this up?', 'Draft a one-page note on this'] });
  onFrame?.({ timing: { total_ms: 900 }, usage: null });
  const id = `m-${Date.now().toString(36)}`;
  conv.messages.push({ id: `${id}-q`, role: 'user', content: body.message, created_at: new Date().toISOString() },
    { id, role: 'assistant', content: answer, sources, follow_ups: [], status: 'complete', model_served: 'sample', created_at: new Date().toISOString() });
  conv.last_message_at = new Date().toISOString();
  await setJSON(CONV_KEY, convs.slice(0, 40));
  onFrame?.({ done: { message_id: id } });
}

export const cancelTurn = async () => {};
export async function listConversations() {
  const convs = await getJSON(CONV_KEY, []);
  return convs.map(({ messages: _m, ...c }) => c);
}
export async function getMessages(id) { return (await getJSON(CONV_KEY, [])).find((c) => c.id === id)?.messages || []; }
export async function renameConversation(id, title) {
  const convs = await getJSON(CONV_KEY, []);
  await setJSON(CONV_KEY, convs.map((c) => (c.id === id ? { ...c, title: String(title).slice(0, 80) } : c)));
}
export async function deleteConversation(id) { await setJSON(CONV_KEY, (await getJSON(CONV_KEY, [])).filter((c) => c.id !== id)); }

// ---------- watchlist ----------
export const getWatchlist = () => getJSON('nter.sample.watchlist', null);
export const saveWatchlist = (list) => setJSON('nter.sample.watchlist', list.slice(0, 24));

export const pricingUrl = () => 'https://www.nter.pro/#pricing';
