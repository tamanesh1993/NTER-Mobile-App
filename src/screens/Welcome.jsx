// The first page: a phone-sized replica of the nter.pro home page, with the site's own globe.
import { useEffect, useState } from 'react';
import { useApp } from '../state/app.jsx';
import { api } from '../services/index.js';
import { SITE_FIGURES } from '../services/shape.js';
import { loadGlobe } from '../globe/index.js';
import { PERSONAS } from '../data/personas.js';
import { PersonaGlyph } from '../ui/personaGlyph.jsx';
import Icon from '../ui/Icon.jsx';
import { SampleBadge } from '../ui/kit.jsx';
import { asset } from '../lib/asset.js';

export default function Welcome() {
  const { setStage, openSheet, browseAsGuest, setAuthEmail } = useApp();
  const [figures, setFigures] = useState(SITE_FIGURES);
  const [paused, setPaused] = useState(false);
  const [globe, setGlobe] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGlobe().then((ok) => alive && setGlobe(ok));
    api.siteFigures().then((f) => alive && setFigures(f)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const glance = [
    [figures.bills.toLocaleString('en-IN'), 'Bills on record', 'b'],
    [figures.modules, 'Research modules', 'p'],
    [figures.endpoints, 'Source endpoints', 'r'],
    [figures.desks, 'Intelligence desks', 'b'],
    [figures.ministries, 'Ministries', 'p'],
    [figures.houses, 'Houses covered', 'r'],
    [figures.since, 'Coverage since', 'b'],
  ];
  const start = (persona) => { setAuthEmail(''); setStage('signup'); if (persona) sessionStorage.setItem('nter.pickPersona', persona.db); };

  return (
    <div className="view">
      <div className="welcome lp2">
        <div className="scroll">
          <div className="lp-nav">
            <div className="brand"><img src={asset('/brand/logo-128.webp')} alt="nter.pro" /><div><b>TERMINAL</b><small>BY NTER.PRO</small></div></div>
            <button type="button" className="signin" onClick={() => setStage('signin')}>Sign in</button>
            <button type="button" className="get" onClick={() => start()}>Get started</button>
          </div>
          <div className="lp-hero">
            <div className="lp-eyebrow"><i>✳</i>THE RESEARCH TERMINAL <SampleBadge /></div>
            <h1>The intelligence layer for <span className="b">Government,</span> <span className="p">Policy</span> &amp; Global Affairs<span className="r">.</span></h1>
            <p className="lead">See what a record touches — before you argue about it.</p>
            <p className="sub">Official sources across legislation, fronts, markets, carbon and the courts — with every connection labelled. Investigate the record without leaving the desk.</p>
            <div className="lp-ctas">
              <button type="button" className="open" onClick={() => setStage('signin')}>Open the terminal</button>
              <button type="button" className="plans" onClick={() => openSheet('plans')}>See plans</button>
            </div>
            <button type="button" className="lp-cov" onClick={() => document.getElementById('lpGlance')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>View data coverage <Icon name="down" /></button>
          </div>
          <div className="lp-globe">
            <div className="nd-globe-column">
              <div className="nter-globe-scene">
                {globe ? <nter-data-globe {...(paused ? { paused: '' } : {})} /> : <img className="globe-still" src={asset('/textures/globe-still.webp')} alt="" />}
                <button type="button" className="data-globe-pause" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume globe' : 'Pause globe'}>
                  {paused
                    ? <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor"><path d="M3 1.5l7 4.5-7 4.5z" /></svg>
                    : <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" /></svg>}
                </button>
              </div>
            </div>
          </div>
          <div className="lp-glance" id="lpGlance">
            <div className="gk">THE RECORD, AT A GLANCE</div>
            <div className="gr">{glance.map(([n, l, c]) => <div key={l}><b className={c}>{n}</b><span>{l}</span></div>)}</div>
          </div>
          <div className="lp-persona">
            <div className="k2">CURATED FOR</div>
            <h2>Find your perspective<span className="r">.</span></h2>
            <div className="one">One platform. Built around you.</div>
            {PERSONAS.map((p) => (
              <button key={p.id} type="button" className="lp-pcard" onClick={() => start(p)}>
                <span className="ic" style={{ background: p.tile[0], color: p.tile[1] }}><PersonaGlyph id={p.id} /></span>
                <span><b>{p.plural}</b><span>{p.tag}</span></span>
              </button>
            ))}
            <div className="choose">Choose a role. Discover your view.</div>
          </div>
          <div className="lp-foot">
            <button type="button" className="open" onClick={() => setStage('signin')}>Open the terminal <Icon name="chev" /></button>
            <button type="button" className="guest" onClick={browseAsGuest}>Browse the desks without an account</button>
            <small>NTER.PRO · TERMINAL · SAME ACCOUNT AS THE WEBSITE</small>
          </div>
        </div>
      </div>
    </div>
  );
}
