/**
 * ScenarioContext.tsx
 * -----------------------------------------------------------------------------
 * Η μηχανή εκτέλεσης (state machine) της προσομοίωσης. Διαχειρίζεται:
 *  - πλοήγηση στους κόμβους (message / decision / gate / end)
 *  - score, vitals, flags
 *  - global rules (alarm υποξαιμίας)
 *  - EHR δεδομένα & validation των documentation gates
 *  - πλήρες action logging (NODE_ENTER, OPTION_SELECTED, EHR_SUBMIT, VITALS_CHANGE…)
 *  - toasts
 * -----------------------------------------------------------------------------
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type {
  DecisionOption,
  EngineState,
  GateRequirements,
  LogEvent,
  LogEventType,
  Scenario,
  ScenarioNode,
  ToastMessage,
  ToastStyle,
  Vitals,
  VitalsUpdate,
} from '../types';

/* ----------------------------- Helpers ----------------------------------- */

let toastSeq = 0;

function seedFlags(scenario: Scenario): Record<string, boolean> {
  const s = scenario.initial_state as unknown as Record<string, unknown>;
  const flags: Record<string, boolean> = {};
  for (const key of Object.keys(s)) {
    if (typeof s[key] === 'boolean') flags[key] = s[key] as boolean;
  }
  return flags;
}

function findNode(scenario: Scenario, id: string | null): ScenarioNode | null {
  if (!id) return null;
  return scenario.nodes.find((n) => n.id === id) ?? null;
}

/** Αξιολογεί τα global rules. Επί του παρόντος: alarm υποξαιμίας (spo2 < 90). */
function evaluateMonitorAlert(scenario: Scenario | null, vitals: Vitals): boolean {
  if (!scenario) return false;
  for (const rule of scenario.rules.global_rules) {
    const cond = rule.condition['vitals.spo2'];
    if (cond && typeof cond.lt === 'number' && vitals.spo2 < cond.lt) return true;
  }
  return false;
}

/* ------------------------------ Actions ---------------------------------- */

type Action =
  | { kind: 'LOAD_SCENARIO'; scenario: Scenario }
  | { kind: 'START' }
  | { kind: 'RESET' }
  | { kind: 'OPEN_HOTSPOT'; hotspotId: string }
  | { kind: 'CLOSE_HOTSPOT' }
  | { kind: 'SELECT_OPTION'; option: DecisionOption }
  | { kind: 'CONTINUE_MESSAGE' }
  | { kind: 'FIRE_TIMEOUT' }
  | { kind: 'UPDATE_EHR_FIELD'; formId: string; fieldId: string; value: string }
  | { kind: 'SUBMIT_EHR_FORM'; formId: string; formTitle: string }
  | { kind: 'GATE_ATTEMPT' }
  | { kind: 'PUSH_TOAST'; message: string; style: ToastStyle }
  | { kind: 'DISMISS_TOAST'; id: number };

/* --------------------------- Logging utility ----------------------------- */

interface LogDraft {
  type: LogEventType;
  label: string;
  nodeId?: string | null;
  scoreDelta?: number;
  outcome?: 'positive' | 'negative' | 'neutral';
  meta?: Record<string, unknown>;
}

function makeLog(state: EngineState, draft: LogDraft): LogEvent {
  const now = Date.now();
  const elapsedMs = state.startedAt ? now - state.startedAt : 0;
  return {
    seq: state.log.length + 1,
    type: draft.type,
    timestamp: new Date(now).toISOString(),
    elapsedMs,
    nodeId: draft.nodeId !== undefined ? draft.nodeId : state.currentNodeId,
    label: draft.label,
    scoreDelta: draft.scoreDelta,
    outcome: draft.outcome,
    meta: draft.meta,
  };
}

function pushToast(state: EngineState, message: string, style: ToastStyle): ToastMessage[] {
  toastSeq += 1;
  return [...state.toasts, { id: toastSeq, message, style }];
}

/**
 * Είσοδος σε νέο κόμβο: ενημερώνει currentNodeId, κλείνει modal, καταγράφει
 * NODE_ENTER, αξιολογεί global rules και χειρίζεται τον τερματικό κόμβο.
 */
function enterNode(state: EngineState, nodeId: string): EngineState {
  const scenario = state.scenario!;
  const node = findNode(scenario, nodeId);
  if (!node) return state;

  let log = [...state.log];
  let toasts = state.toasts;
  const monitorAlert = evaluateMonitorAlert(scenario, state.vitals);

  let working: EngineState = {
    ...state,
    currentNodeId: nodeId,
    activeHotspot: null,
    monitorAlert,
  };

  log = [
    ...log,
    makeLog(working, {
      type: 'NODE_ENTER',
      label: `Είσοδος σε κόμβο: ${node.id} (${node.type})`,
      nodeId: node.id,
      outcome: 'neutral',
    }),
  ];

  if (node.type === 'end') {
    working = { ...working, status: 'ended' };
    log = [
      ...log,
      makeLog(working, {
        type: 'SCENARIO_END',
        label: `Ολοκλήρωση σεναρίου — Τελικό Score: ${working.score}`,
        nodeId: node.id,
        outcome: 'neutral',
      }),
    ];
  }

  return { ...working, log, toasts };
}

/** Εφαρμογή vitals_update με καταγραφή VITALS_CHANGE και έλεγχο alarm. */
function applyVitals(
  state: EngineState,
  update: VitalsUpdate,
): { vitals: Vitals; log: LogEvent[]; toasts: ToastMessage[]; monitorAlert: boolean } {
  const vitals: Vitals = { ...state.vitals, ...update };
  const changed = Object.keys(update) as (keyof Vitals)[];
  const desc = changed
    .map((k) => `${k.toUpperCase()}: ${state.vitals[k]} → ${vitals[k]}`)
    .join(', ');

  let log = [
    ...state.log,
    makeLog(state, {
      type: 'VITALS_CHANGE',
      label: `Μεταβολή ζωτικών — ${desc}`,
      outcome: vitals.spo2 < state.vitals.spo2 ? 'negative' : 'positive',
      meta: { from: state.vitals, to: vitals },
    }),
  ];

  const monitorAlert = evaluateMonitorAlert(state.scenario, vitals);
  let toasts = state.toasts;
  if (monitorAlert) {
    const rule = state.scenario?.rules.global_rules.find((r) => r.id === 'rule_hypoxia_alarm');
    const eff = rule?.effects.find((e) => e.type === 'ui_toast');
    if (eff?.message) {
      toastSeq += 1;
      toasts = [...toasts, { id: toastSeq, message: eff.message, style: 'danger' }];
    }
  }

  return { vitals, log, toasts, monitorAlert };
}

/* ------------------------------ Reducer ---------------------------------- */

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.kind) {
    case 'LOAD_SCENARIO': {
      return { ...state, scenario: action.scenario, status: 'selecting' };
    }

    case 'START': {
      const scenario = state.scenario;
      if (!scenario) return state;
      const startedAt = Date.now();
      const firstNode = scenario.nodes[0];
      const base: EngineState = {
        ...state,
        status: 'running',
        score: scenario.initial_state.current_score,
        vitals: { ...scenario.initial_state.vitals },
        flags: seedFlags(scenario),
        startedAt,
        timeElapsedMs: 0,
        activeHotspot: null,
        ehrData: {},
        log: [],
        toasts: [],
        monitorAlert: scenario.initial_state.ui.monitor_alert,
        currentNodeId: null,
      };
      const withStartLog: EngineState = {
        ...base,
        log: [
          makeLog(base, {
            type: 'SCENARIO_START',
            label: `Έναρξη σεναρίου: ${scenario.scenario_meta.title}`,
            nodeId: null,
            outcome: 'neutral',
          }),
        ],
      };
      return enterNode(withStartLog, firstNode.id);
    }

    case 'RESET': {
      return {
        ...state,
        status: 'selecting',
        currentNodeId: null,
        startedAt: null,
        timeElapsedMs: 0,
        activeHotspot: null,
        ehrData: {},
        log: [],
        toasts: [],
        monitorAlert: false,
      };
    }

    case 'OPEN_HOTSPOT': {
      const log = [
        ...state.log,
        makeLog(state, {
          type: 'HOTSPOT_INTERACTION',
          label: `Άνοιγμα hotspot: ${action.hotspotId}`,
          meta: { hotspot: action.hotspotId },
          outcome: 'neutral',
        }),
      ];
      return { ...state, activeHotspot: action.hotspotId, log };
    }

    case 'CLOSE_HOTSPOT':
      return { ...state, activeHotspot: null };

    case 'SELECT_OPTION': {
      const { option } = action;
      const eff = option.effects;
      let working = { ...state };

      // 1) score
      const scoreDelta = eff.score_delta ?? 0;
      working = { ...working, score: working.score + scoreDelta };

      // 2) flags
      if (eff.state_update) {
        const flags = { ...working.flags };
        for (const [key, val] of Object.entries(eff.state_update)) {
          const flagKey = key.startsWith('flags.') ? key.slice('flags.'.length) : key;
          flags[flagKey] = val;
        }
        working = { ...working, flags };
      }

      // 3) log OPTION_SELECTED
      working = {
        ...working,
        log: [
          ...working.log,
          makeLog(working, {
            type: 'OPTION_SELECTED',
            label: `Επιλογή: ${option.label}`,
            scoreDelta,
            outcome: scoreDelta > 0 ? 'positive' : scoreDelta < 0 ? 'negative' : 'neutral',
            meta: { optionId: option.id, hotspot: option.target_hotspot },
          }),
        ],
      };

      // 4) vitals
      if (eff.vitals_update) {
        const r = applyVitals(working, eff.vitals_update);
        working = {
          ...working,
          vitals: r.vitals,
          log: r.log,
          toasts: r.toasts,
          monitorAlert: r.monitorAlert,
        };
      }

      // 5) option toast
      if (eff.toast) {
        working = {
          ...working,
          toasts: pushToast(
            working,
            eff.toast,
            scoreDelta < 0 ? 'warning' : 'success',
          ),
        };
      }

      // 6) advance
      return enterNode(working, option.next_node_id);
    }

    case 'CONTINUE_MESSAGE': {
      const node = findNode(state.scenario!, state.currentNodeId);
      if (!node?.next_node_id) return state;
      return enterNode(state, node.next_node_id);
    }

    case 'FIRE_TIMEOUT': {
      const node = findNode(state.scenario!, state.currentNodeId);
      if (!node?.timeout) return state;
      const t = node.timeout;
      let working = { ...state };

      const scoreDelta = t.on_timeout_effects.score_delta ?? 0;
      working = { ...working, score: working.score + scoreDelta };

      working = {
        ...working,
        log: [
          ...working.log,
          makeLog(working, {
            type: 'TIMEOUT',
            label: `Λήξη χρόνου (${t.seconds}s) στον κόμβο ${node.id}`,
            scoreDelta,
            outcome: 'negative',
          }),
        ],
      };

      if (t.on_timeout_effects.vitals_update) {
        const r = applyVitals(working, t.on_timeout_effects.vitals_update);
        working = {
          ...working,
          vitals: r.vitals,
          log: r.log,
          toasts: r.toasts,
          monitorAlert: r.monitorAlert,
        };
      }

      if (t.on_timeout_effects.toast) {
        working = { ...working, toasts: pushToast(working, t.on_timeout_effects.toast, 'danger') };
      }

      return enterNode(working, t.next_node_id);
    }

    case 'UPDATE_EHR_FIELD': {
      const form = state.ehrData[action.formId] ?? {};
      return {
        ...state,
        ehrData: {
          ...state.ehrData,
          [action.formId]: { ...form, [action.fieldId]: action.value },
        },
      };
    }

    case 'SUBMIT_EHR_FORM': {
      const data = state.ehrData[action.formId] ?? {};
      const log = [
        ...state.log,
        makeLog(state, {
          type: 'EHR_SUBMIT',
          label: `Υποβολή φόρμας EHR: ${action.formTitle}`,
          outcome: 'positive',
          meta: { formId: action.formId, values: { ...data } },
        }),
      ];
      return {
        ...state,
        log,
        toasts: pushToast(state, `Αποθηκεύτηκε: ${action.formTitle}`, 'success'),
      };
    }

    case 'GATE_ATTEMPT': {
      const node = findNode(state.scenario!, state.currentNodeId);
      const req = node?.gate_requirements;
      if (!node || !req) return state;

      const missing = getMissingGateFields(req, state.ehrData);
      if (missing.length > 0) {
        const log = [
          ...state.log,
          makeLog(state, {
            type: 'GATE_BLOCKED',
            label: `Gate μπλοκαρισμένο — ελλιπή πεδία (${missing.length})`,
            outcome: 'negative',
            meta: { missing },
          }),
        ];
        return {
          ...state,
          log,
          toasts: pushToast(state, req.feedback_blocked, 'danger'),
        };
      }

      // Pass: εφαρμογή effects_on_pass
      let working = { ...state };
      const scoreDelta = req.effects_on_pass.score_delta ?? 0;
      working = { ...working, score: working.score + scoreDelta };

      if (req.effects_on_pass.state_update) {
        const flags = { ...working.flags };
        for (const [key, val] of Object.entries(req.effects_on_pass.state_update)) {
          const flagKey = key.startsWith('flags.') ? key.slice('flags.'.length) : key;
          flags[flagKey] = val;
        }
        working = { ...working, flags };
      }

      working = {
        ...working,
        log: [
          ...working.log,
          makeLog(working, {
            type: 'GATE_PASSED',
            label: `Gate ολοκληρώθηκε: ${node.id}`,
            scoreDelta,
            outcome: 'positive',
          }),
        ],
        toasts: pushToast(working, req.feedback_success, 'success'),
      };

      return enterNode(working, node.next_node_id!);
    }

    case 'PUSH_TOAST':
      return { ...state, toasts: pushToast(state, action.message, action.style) };

    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    default:
      return state;
  }
}

/* ------------------- Validation helper (export) -------------------------- */

export function getMissingGateFields(
  req: GateRequirements,
  ehrData: EngineState['ehrData'],
): { form_id: string; field: string }[] {
  const missing: { form_id: string; field: string }[] = [];
  for (const form of req.required_forms) {
    const data = ehrData[form.form_id] ?? {};
    for (const field of form.fields) {
      const v = data[field];
      if (!v || v.trim() === '') missing.push({ form_id: form.form_id, field });
    }
  }
  return missing;
}

/* ------------------------------ Context ---------------------------------- */

interface ScenarioContextValue {
  state: EngineState;
  currentNode: ScenarioNode | null;
  loadScenario: (scenario: Scenario) => void;
  start: () => void;
  reset: () => void;
  openHotspot: (id: string) => void;
  closeHotspot: () => void;
  selectOption: (option: DecisionOption) => void;
  continueMessage: () => void;
  fireTimeout: () => void;
  updateEhrField: (formId: string, fieldId: string, value: string) => void;
  submitEhrForm: (formId: string, formTitle: string) => void;
  attemptGate: () => void;
  pushToast: (message: string, style: ToastStyle) => void;
  dismissToast: (id: number) => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

function createInitialState(): EngineState {
  return {
    status: 'selecting',
    scenario: null,
    currentNodeId: null,
    score: 0,
    vitals: { hr: 0, spo2: 0, rr: 0, bp: '--/--', temp: 0 },
    flags: {},
    startedAt: null,
    timeElapsedMs: 0,
    activeHotspot: null,
    ehrData: {},
    log: [],
    toasts: [],
    monitorAlert: false,
  };
}

export function ScenarioProvider({
  scenario,
  children,
}: {
  scenario: Scenario;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, scenario, (s) => ({
    ...createInitialState(),
    scenario: s,
  }));

  const loadScenario = useCallback((sc: Scenario) => dispatch({ kind: 'LOAD_SCENARIO', scenario: sc }), []);
  const start = useCallback(() => dispatch({ kind: 'START' }), []);
  const reset = useCallback(() => dispatch({ kind: 'RESET' }), []);
  const openHotspot = useCallback((id: string) => dispatch({ kind: 'OPEN_HOTSPOT', hotspotId: id }), []);
  const closeHotspot = useCallback(() => dispatch({ kind: 'CLOSE_HOTSPOT' }), []);
  const selectOption = useCallback((option: DecisionOption) => dispatch({ kind: 'SELECT_OPTION', option }), []);
  const continueMessage = useCallback(() => dispatch({ kind: 'CONTINUE_MESSAGE' }), []);
  const fireTimeout = useCallback(() => dispatch({ kind: 'FIRE_TIMEOUT' }), []);
  const updateEhrField = useCallback(
    (formId: string, fieldId: string, value: string) =>
      dispatch({ kind: 'UPDATE_EHR_FIELD', formId, fieldId, value }),
    [],
  );
  const submitEhrForm = useCallback(
    (formId: string, formTitle: string) => dispatch({ kind: 'SUBMIT_EHR_FORM', formId, formTitle }),
    [],
  );
  const attemptGate = useCallback(() => dispatch({ kind: 'GATE_ATTEMPT' }), []);
  const pushToast = useCallback(
    (message: string, style: ToastStyle) => dispatch({ kind: 'PUSH_TOAST', message, style }),
    [],
  );
  const dismissToast = useCallback((id: number) => dispatch({ kind: 'DISMISS_TOAST', id }), []);

  const currentNode = useMemo(
    () => findNode(state.scenario!, state.currentNodeId),
    [state.scenario, state.currentNodeId],
  );

  const value = useMemo<ScenarioContextValue>(
    () => ({
      state,
      currentNode,
      loadScenario,
      start,
      reset,
      openHotspot,
      closeHotspot,
      selectOption,
      continueMessage,
      fireTimeout,
      updateEhrField,
      submitEhrForm,
      attemptGate,
      pushToast,
      dismissToast,
    }),
    [
      state,
      currentNode,
      loadScenario,
      start,
      reset,
      openHotspot,
      closeHotspot,
      selectOption,
      continueMessage,
      fireTimeout,
      updateEhrField,
      submitEhrForm,
      attemptGate,
      pushToast,
      dismissToast,
    ],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario πρέπει να χρησιμοποιείται εντός ScenarioProvider');
  return ctx;
}
