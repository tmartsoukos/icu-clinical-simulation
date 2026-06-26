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
import rawScenario2 from './data/level2.json';
import { ScenarioProvider, useScenario } from './context/ScenarioContext';
import type { Scenario } from './types';
import DebriefScreen from './components/DebriefScreen';
import ICUWardView from './components/ICUWardView';
import ScenarioSelector from './components/ScenarioSelector';
import Toasts from './components/Toasts';

const BUILT_IN_SCENARIOS: Scenario[] = [
  rawScenario as unknown as Scenario,
  rawScenario2 as unknown as Scenario,
];

function Router() {
  const { state } = useScenario();

  return (
    <>
      {state.status === 'selecting' && <ScenarioSelector builtIns={BUILT_IN_SCENARIOS} />}
      {state.status === 'running' && <ICUWardView />}
      {state.status === 'ended' && <DebriefScreen />}
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <ScenarioProvider scenario={BUILT_IN_SCENARIOS[0]}>
      <Router />
    </ScenarioProvider>
  );
}
