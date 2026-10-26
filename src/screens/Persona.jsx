// Onboarding: choose a perspective. It sets the Quick Exit catalogue, the starter questions and
// the persona nter.pro stores on the profile.
import { useState } from 'react';
import { useApp } from '../state/app.jsx';
import { PERSONAS } from '../data/personas.js';
import { Header } from '../ui/kit.jsx';
import Icon from '../ui/Icon.jsx';

export default function PersonaScreen() {
  const { choosePersona, personaDb, signedIn, signOut, setStage } = useApp();
  const [pick, setPick] = useState(PERSONAS.find((p) => p.db === personaDb) || PERSONAS[0]);
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); await choosePersona(pick); setBusy(false); };
  return (
    <div className="view">
      <Header back onBack={() => (signedIn ? signOut() : setStage('welcome'))} />
      <div className="body">
        <div className="lead">
          <div className="k accent">CURATED FOR</div>
          <h2 style={{ marginTop: 6 }}>Find your <em>perspective.</em></h2>
          <p>One platform, built around you. This sets your Quick Exits, your starter questions and how answers are written. You can change it later under Me.</p>
        </div>
        <div className="pwrap">
          {PERSONAS.map((p) => (
            <button key={p.id} type="button" className={`pcard ${pick.id === p.id ? 'on' : ''}`} onClick={() => setPick(p)} aria-pressed={pick.id === p.id}>
              <span className="ic"><Icon name={p.icon} /></span>
              <span style={{ flex: 1, minWidth: 0 }}><b>{p.plural}</b><span>{p.tag}</span></span>
              <span className="tick">{pick.id === p.id ? <Icon name="check" /> : null}</span>
            </button>
          ))}
          <button type="button" className="pbtn" style={{ marginTop: 6 }} disabled={busy} onClick={go}>Continue as {pick.name}</button>
        </div>
      </div>
    </div>
  );
}
