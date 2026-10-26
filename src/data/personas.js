// The six perspectives, exactly as nter.pro stores them (app_persona enum) and labels them.
// `qe` is the persona's index in the Quick Exit catalogue.
export const PERSONAS = [
  { db: 'policy_analyst', id: 'policy', name: 'Policy Analyst', plural: 'Policy Analysts', tag: 'Policy into perspective', icon: 'policy', tile: ['#e9edfb', '#293fa5'], qe: 0,
    starters: ['What changed in a bill between introduction and passage?', 'Which Law and Justice bills are still pending this session?', 'Draft a starred question on tribunal vacancies for the next session'] },
  { db: 'journalist', id: 'journalist', name: 'Journalist', plural: 'Journalists', tag: 'Follow the public record', icon: 'mic', tile: ['#fae9eb', '#c2353d'], qe: 1,
    starters: ['What did the government say on record about tribunal vacancies this year?', 'Give me a backgrounder on a bill for a filing today', 'Has any minister answered a question on this in the House?'] },
  { db: 'upsc_aspirant', id: 'student', name: 'UPSC Aspirant', plural: 'UPSC Aspirants', tag: 'Connect your current affairs', icon: 'book', tile: ['#f0e5d7', '#8d7151'], qe: 2,
    starters: ['Explain a bill for Prelims: facts, traps and interlinks', 'Write a 150-word Mains answer on tribunalisation in India', 'Make 5 statement-type MCQs from this record'] },
  { db: 'corporate_affairs', id: 'analyst', name: 'Corporate Affairs', plural: 'Corporate Affairs', tag: 'See the regulatory picture', icon: 'briefcase', tile: ['#e9edfb', '#293fa5'], qe: 3,
    starters: ['Which regulated entities does this record touch, and from when?', "Summarise last week's regulatory instruments for the compliance call", 'Is this record naming any listed company or sector obligation?'] },
  { db: 'legal_researcher', id: 'lawyer', name: 'Legal Researcher', plural: 'Legal Researchers', tag: 'Find the source behind a case', icon: 'scale', tile: ['#eee6f5', '#572c91'], qe: 4,
    starters: ['Which provisions of the parent Act does this bill amend?', 'Find Supreme Court orders on tribunal appointments since 2021', 'Build a search plan on the validity of tribunal tenure rules'] },
  { db: 'academic', id: 'academic', name: 'Academic', plural: 'Academics', tag: 'Research across time', icon: 'grad', tile: ['#f0e5d7', '#8d7151'], qe: 5,
    starters: ['Trace the legislative history of tribunal reforms since 2017', 'Cite this record in Chicago and BibTeX', 'Build a reading list of primary sources on tribunalisation'] },
];
export const personaByDb = (db) => PERSONAS.find((p) => p.db === db) || null;
export const personaById = (id) => PERSONAS.find((p) => p.id === id) || null;
