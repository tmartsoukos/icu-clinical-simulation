/**
 * App.tsx
 * -----------------------------------------------------------------------------
 * Ρίζα της εφαρμογής. Παρέχει τον ScenarioProvider και κάνει routing μεταξύ των
 * τριών καταστάσεων της μηχανής:
 *   selecting → ScenarioSelector (Landing)
 *   running   → ICUWardView (κύρια προσομοίωση)
 *   ended     → DebriefScreen (αποτελέσματα)
 * Τα Toasts είναι πάντα ενεργά (overlay).
 * -----------------------------------------------------------------------------
 */

import rawScenario from './data/scenario.json';
import { ScenarioProvider, useScenario } from './context/ScenarioContext';
import type { Scenario } from './types';
import DebriefScreen from './components/DebriefScreen';
import ICUWardView from './components/ICUWardView';
import ScenarioSelector from './components/ScenarioSelector';
import Toasts from './components/Toasts';

const BUILT_IN_SCENARIO = rawScenario as unknown as Scenario;

function Router() {
  const { state } = useScenario();

  return (
    <>
      {state.status === 'selecting' && <ScenarioSelector builtIn={BUILT_IN_SCENARIO} />}
      {state.status === 'running' && <ICUWardView />}
      {state.status === 'ended' && <DebriefScreen />}
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <ScenarioProvider scenario={BUILT_IN_SCENARIO}>
      <Router />
    </ScenarioProvider>
  );
}
