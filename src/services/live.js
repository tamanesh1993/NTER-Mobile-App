// The live service: the same backend nter.pro runs on. Sign-in, profile, plan, credits,
// conversations and the watchlist go through Supabase with the member's own session (row-level
// security decides what they can read and change); desks and the news feed come from
// www.nter.pro's public /api routes; answers come from the research-chat edge function.
// Nothing here uses a server secret.
import { supabase, accessToken } from '../lib/supabaseClient.js';
import { apiGet, HttpError } from '../lib/http.js';
import { functionsUrl, SUPABASE_KEY, STREAM_CHAT, API_BASE } from '../lib/config.js';
import { readSseFrames } from '../lib/sse.js';
import { isNative } from '../lib/platform.js';
import { PAGED_FEATURES, DESKS } from '../data/desks.js';
import { pickColumns, rowTitle, mergeFigures, SITE_FIGURES } from './shape.js';
import * as sample from './sample.js';

const one = (data) => (Array.isArray(data) ? data[0] ?? null : data ?? null);
const fail = (error, fallback) => { if (error) throw new Error(error.message || fallback); };

// ---------- auth ----------
export const mode = 'live';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session || null));
  return () => data?.subscription?.unsubscribe?.();
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(/invalid login/i.test(error.message) ? 'Email or password is incorrect.' : error.message);
  return data.session;
}

export async function signUp({ email, password, firstName, lastName, persona }) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name, first_name: firstName || '', last_name: lastName || '', personaId: persona?.id || null, plan: 'free' } },
  });
  if (error) throw new Error(error.message);
  // With email confirmation on, there is a user but no session until the link is opened.
  return { session: data.session || null, needsConfirmation: !data.session };
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  fail(error, 'Could not resend the email.');
}

export async function forgotPassword(email) {
  // The reset form lives on the website; the link opens there on any device.
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${API_BASE}/#reset-password` });
  fail(error, 'Could not send the reset email.');
}

export const OAUTH_REDIRECT = 'pro.nter.app://auth/callback';

export async function signInWithGoogle() {
  const redirectTo = isNative() ? OAUTH_REDIRECT : window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: isNative() } });
  fail(error, 'Google sign-in is unavailable.');
  if (isNative() && data?.url) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  }
}

// Called by the app when the OS hands it pro.nter.app://auth/callback?code=…
export async function completeOAuth(url) {
  const code = new URL(url).searchParams.get('code');
  if (!code) return null;
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  fail(error, 'Sign-in could not be completed.');
  try { (await import('@capacitor/browser')).Browser.close(); } catch { /* already closed */ }
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' });
}

// ---------- profile, plan, credits, models ----------
export async function getProfile() {
  const { data, error } = await supabase.rpc('get_my_profile');
  fail(error, 'Could not load your profile.');
  return one(data);
}

export async function setPersona(db) {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) throw new Error('Sign in first.');
  const { error } = await supabase.from('user_profiles').update({ persona: db }).eq('user_id', uid);
  fail(error, 'Could not save your role.');
}

export async function getEntitlement() {
  const { data, error } = await supabase.rpc('my_entitlement_manual');
  fail(error, 'Could not load your plan.');
  return one(data);
}

export async function getCredits() {
  const { data, error } = await supabase.rpc('my_credits_cycle_v3');
  fail(error, 'Could not load your credits.');
  return one(data);
}

export async function getModels() {
  const [models, estimates] = await Promise.all([
    supabase.from('ai_models').select('model_id,label,vendor,tier,efforts,params,is_default,sort_order,min_plan').eq('enabled', true).order('sort_order'),
    supabase.rpc('model_credit_estimates'),
  ]);
  fail(models.error, 'Could not load the AI models.');
  const cost = new Map((estimates.data || []).map((e) => [e.model_id, e.credits]));
  return (models.data || []).map((m) => ({ ...m, credits: cost.get(m.model_id) ?? null }));
}

// ---------- news and markets (public) ----------
export async function homeLatest({ signal } = {}) {
  try {
    const body = await apiGet('/api/home/latest', { limit: 24 }, { signal, timeoutMs: 12000 });
    const rows = Array.isArray(body?.rows) ? body.rows.filter((r) => r?.title) : [];
    if (rows.length) return { rows, asOf: body.as_of || body.updated || null, fallback: false };
  } catch (e) { if (e?.name === 'AbortError') throw e; }
  return { ...(await sample.homeLatest()), fallback: true };
}

export async function homeMarkets({ signal } = {}) {
  try {
    const body = await apiGet('/api/home/markets', {}, { signal, timeoutMs: 12000 });
    if (Array.isArray(body?.rows) && body.rows.length) return { rows: body.rows, asOf: body.as_of || null, fallback: false };
  } catch (e) { if (e?.name === 'AbortError') throw e; }
  return { ...(await sample.homeMarkets()), fallback: true };
}

export async function siteFigures({ signal } = {}) {
  try { return mergeFigures(await apiGet('/api/site-figures', {}, { signal, timeoutMs: 8000 })); } catch { return SITE_FIGURES; }
}

// ---------- desks ----------
export async function moduleFeed({ module, page = 1, pageSize = 50, q = '', sort, dir, signal }) {
  const paged = PAGED_FEATURES.has(module.feature);
  const params = { tier: module.tier, feature: module.feature, ...(paged ? { page, ...(pageSize !== 50 ? { pageSize } : {}), q: q.trim(), sort, dir: dir === 'desc' ? 'desc' : undefined } : {}) };
  try {
    const body = await apiGet('/api/feature-feed', params, { signal, timeoutMs: 15000 });
    const rows = (Array.isArray(body?.rows) ? body.rows : []).filter((r) => r && r.status !== 'source_status');
    if (body && body.ok !== false && rows.length) {
      return {
        rows,
        columns: pickColumns(rows, body.columns),
        total: Number(body.total ?? body.totalAll ?? rows.length) || rows.length,
        paged: Boolean(body.paged), page: body.page || page, pageSize: body.pageSize || pageSize,
        source: body.source || null, coverage: body.coverage || null, asOf: body.fetchedAt || body.asOf || null,
        fallback: false,
      };
    }
  } catch (e) { if (e?.name === 'AbortError') throw e; }
  const archived = await sample.moduleFeed({ module, page, pageSize, q });
  return { ...archived, fallback: true };
}

// Records across every desk that match the words (the site's command search).
export async function searchRecords(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  const results = await Promise.allSettled(DESKS.map(async (d) => {
    const { data, error } = await supabase.rpc('search_desk_rows', { p_tier: d.id, p_feature: null, p_query: q, p_filters: {}, p_limit: 8 }).abortSignal(signal);
    if (error) throw error;
    return (data || []).filter((r) => r.tier === d.id).map((r) => ({ desk: d.id, tier: r.tier, feature: r.feature, rowKey: r.row_key, row: r.row || {}, title: rowTitle(r.row, r.feature) }));
  }));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

// ---------- record brief ----------
async function postFunction(name, body, { signal } = {}) {
  const token = await accessToken();
  const res = await fetch(functionsUrl(name), {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${token || SUPABASE_KEY}` },
    body: JSON.stringify(body),
    signal,
  });
  return res;
}

function slimRow(row) {
  const out = {};
  let size = 2;
  for (const [k, v] of Object.entries(row || {})) {
    if (v == null || v === '' || typeof v === 'object') continue;
    const s = String(v).slice(0, 2000);
    size += k.length + s.length + 6;
    if (size > 28000) break;
    out[k] = s;
  }
  return out;
}

export async function recordBrief({ module, row, generate = false, signal }) {
  const body = { scope: 'record', tier: module.tier, feature: module.feature, row: slimRow(row), ...(generate ? {} : { mode: 'read' }) };
  const res = await postFunction('desk-brief', body, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new HttpError(res.status, data?.error || 'The brief is unavailable.', data);
  return data; // { ok, state: ready|pending|missing|unavailable, brief, why, watch, tags, model, writtenAt }
}

// ---------- research chat ----------
// Sends one turn and calls onFrame for every frame. With VITE_STREAM_CHAT=1 (the function's
// ALLOWED_ORIGINS lists the app) frames stream as written; otherwise the native HTTP layer
// returns the whole stream at the end, and the frames are replayed in order.
export async function sendTurn(body, { onFrame, signal } = {}) {
  const token = await accessToken();
  if (!token) throw new HttpError(401, 'Sign in to ask the AI.');
  const doFetch = STREAM_CHAT && isNative() && window.CapacitorWebFetch ? window.CapacitorWebFetch : fetch;
  const res = await doFetch(functionsUrl('research-chat'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new HttpError(res.status, detail?.error || `The AI could not start (${res.status}).`, detail);
  }
  for await (const frame of readSseFrames(res, signal)) onFrame?.(frame);
}

export async function cancelTurn(conversationId) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id || !conversationId) return;
  await supabase.from('chat_cancellations').upsert({ conversation_id: conversationId, user_id: data.user.id, cancel_requested_at: new Date().toISOString() }, { onConflict: 'conversation_id' });
}

export async function listConversations() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user?.id) return [];
  const { data, error } = await supabase.from('conversations').select('id,title,created_at,last_message_at,web_search')
    .eq('user_id', u.user.id).order('last_message_at', { ascending: false, nullsFirst: false }).limit(40);
  fail(error, 'Could not load your conversations.');
  return data || [];
}

export async function getMessages(conversationId) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('chat_messages')
    .select('id, role, content, sources, web_sources, follow_ups, activity, timing, model_requested, model_served, reasoning_effort, status, error_message, execution_expires_at, turn_key, created_at')
    .eq('conversation_id', conversationId).eq('user_id', u?.user?.id).order('created_at');
  fail(error, 'Could not load this conversation.');
  return data || [];
}

export async function renameConversation(id, title) {
  const { error } = await supabase.from('conversations').update({ title: String(title).trim().slice(0, 80) }).eq('id', id);
  fail(error, 'Could not rename.');
}

export async function deleteConversation(id) {
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  fail(error, 'Could not delete.');
}

// ---------- watchlist ----------
export async function getWatchlist() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user?.id) return null;
  const { data, error } = await supabase.from('user_preferences').select('watchlist').eq('user_id', u.user.id).maybeSingle();
  fail(error, 'Could not load your watchlist.');
  return Array.isArray(data?.watchlist) ? data.watchlist : null;
}

export async function saveWatchlist(list) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user?.id) return;
  const { error } = await supabase.from('user_preferences').upsert({ user_id: u.user.id, watchlist: list.slice(0, 24) }, { onConflict: 'user_id' });
  fail(error, 'Could not save your watchlist.');
}

export const pricingUrl = () => `${API_BASE}/#pricing`;
