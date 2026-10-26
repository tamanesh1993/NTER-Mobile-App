import { AppProvider, useApp } from './state/app.jsx';
import { ChatProvider } from './state/chat.jsx';
import { StudioProvider } from './state/studio.jsx';
import { Toast } from './ui/kit.jsx';
import Welcome from './screens/Welcome.jsx';
import { SignIn, SignUp, Verify, Forgot } from './screens/Auth.jsx';
import PersonaScreen from './screens/Persona.jsx';
import Home from './screens/Home.jsx';
import Story from './screens/Story.jsx';
import Ask from './screens/Ask.jsx';
import Library, { DeskScreen } from './screens/Library.jsx';
import Sector from './screens/Sector.jsx';
import ModuleScreen from './screens/Module.jsx';
import RecordScreen from './screens/Record.jsx';
import Search from './screens/Search.jsx';
import Make from './screens/Make.jsx';
import Me, { MyLibrary, About } from './screens/Me.jsx';
import SheetHost from './sheets/SheetHost.jsx';
import { asset } from './lib/asset.js';

const ROOTS = { home: Home, ask: Ask, library: Library, me: Me };
const VIEWS = { story: Story, desk: DeskScreen, sector: Sector, module: ModuleScreen, record: RecordScreen, search: Search, make: Make, mylib: MyLibrary, about: About };

// Each tab keeps its root and every pushed view mounted, so going back returns to the same
// scroll position and filters; only the top view is visible and interactive.
function TabStack({ id, active }) {
  const { stacks } = useApp();
  const stack = stacks[id];
  const Root = ROOTS[id];
  return (
    <div className={`tabstack${active ? '' : ' off'}`}>
      <div className={`layer${stack.length ? ' under' : ''}`}><Root /></div>
      {stack.map((entry, i) => {
        const View = VIEWS[entry.v];
        if (!View) return null;
        return (
          <div key={`${i}-${entry.v}-${entry.key || ''}`} className={`layer${i < stack.length - 1 ? ' under' : ''}`}>
            <View {...entry} />
          </div>
        );
      })}
    </div>
  );
}

function Shell() {
  const { booting, stage, tab } = useApp();
  if (booting) return <div className="boot"><img src={asset('/brand/logo-128.webp')} alt="nter.pro" /></div>;
  let screen;
  if (stage === 'welcome') screen = <Welcome />;
  else if (stage === 'signin') screen = <SignIn />;
  else if (stage === 'signup') screen = <SignUp />;
  else if (stage === 'verify') screen = <Verify />;
  else if (stage === 'forgot') screen = <Forgot />;
  else if (stage === 'persona') screen = <PersonaScreen />;
  else screen = ['home', 'ask', 'library', 'me'].map((id) => <TabStack key={id} id={id} active={tab === id} />);
  return (
    <div className="app">
      {screen}
      <SheetHost />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <div className="root">
      <AppProvider>
        <ChatProvider>
          <StudioProvider>
            <Shell />
          </StudioProvider>
        </ChatProvider>
      </AppProvider>
    </div>
  );
}
