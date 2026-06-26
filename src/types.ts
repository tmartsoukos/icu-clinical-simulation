/**
 * types.ts
 * -----------------------------------------------------------------------------
 * Πλήρης τυποποίηση του JSON σεναρίου της προσομοίωσης ΜΕΘ καθώς και των
 * εσωτερικών δομών της μηχανής εκτέλεσης (engine state, logging, EHR).
 * -----------------------------------------------------------------------------
 */

/* ------------------------------- Vitals ---------------------------------- */

export interface Vitals {
  hr: number;
  spo2: number;
  rr: number;
  bp: string;
  temp: number;
}

export type VitalsUpdate = Partial<Vitals>;

/* --------------------------- Scenario metadata --------------------------- */

export interface ScenarioMeta {
  id: string;
  title: string;
  description: string;
  estimated_duration_minutes: number;
  difficulty: string;
  learning_goals: string[];
}

/* ------------------------------ UI / flags ------------------------------- */

export interface InitialUiState {
  active_hotspots: string[];
  monitor_alert: boolean;
}

export interface InitialState {
  time_elapsed: number;
  current_score: number;
  assessment_complete: boolean;
  oxygen_adjusted: boolean;
  documentation_1_complete: boolean;
  escalation_complete: boolean;
  documentation_2_complete: boolean;
  vitals: Vitals;
  ui: InitialUiState;
}

/* ------------------------------- Hotspots -------------------------------- */

export type HotspotId =
  | 'hs_monitor'
  | 'hs_patient'
  | 'hs_ventilator'
  | 'hs_ehr'
  | 'hs_call';

export interface Hotspot {
  id: string;
  label: string;
}

/* --------------------------------- EHR ----------------------------------- */

export type EhrFormId = 'assessment_form' | 'intervention_form' | 'communication_log';

export interface EhrFormDef {
  title: string;
  fields: string[];
}

export interface EhrConfig {
  forms: Record<string, EhrFormDef>;
}

/** Τιμές που έχει συμπληρώσει ο χρήστης ανά φόρμα/πεδίο. */
export type EhrData = Record<string, Record<string, string>>;

/* -------------------------------- Rules ---------------------------------- */

export interface RuleEffect {
  type: 'ui_visual' | 'ui_toast';
  target?: string;
  state?: string;
  style?: ToastStyle;
  message?: string;
}

export interface GlobalRule {
  id: string;
  condition: Record<string, { lt?: number; gt?: number; eq?: number }>;
  effects: RuleEffect[];
}

export interface Rules {
  global_rules: GlobalRule[];
}

/* -------------------------------- Nodes ---------------------------------- */

export type NodeType = 'message' | 'decision' | 'gate' | 'end';

export interface OptionEffects {
  score_delta?: number;
  state_update?: Record<string, boolean>;
  vitals_update?: VitalsUpdate;
  toast?: string;
}

export interface DecisionOption {
  id: string;
  label: string;
  target_hotspot: string;
  effects: OptionEffects;
  next_node_id: string;
}

export interface TimeoutEffects {
  vitals_update?: VitalsUpdate;
  score_delta?: number;
  toast?: string;
}

export interface NodeTimeout {
  seconds: number;
  on_timeout_effects: TimeoutEffects;
  next_node_id: string;
}

export interface GateRequiredForm {
  form_id: string;
  fields: string[];
}

export interface GateRequirements {
  target_hotspot: string;
  required_forms: GateRequiredForm[];
  feedback_blocked: string;
  feedback_success: string;
  effects_on_pass: {
    state_update?: Record<string, boolean>;
    score_delta?: number;
  };
}

export interface DebriefConfig {
  show_score: boolean;
  show_decision_path: boolean;
  highlight_missed_docs: boolean;
  export_log: boolean;
}

export interface NodeLogging {
  enabled: boolean;
  log_events: string[];
  export_format: string;
}

export interface ScenarioNode {
  id: string;
  type: NodeType;
  text: string;
  description?: string;
  next_node_id?: string;
  options?: DecisionOption[];
  timeout?: NodeTimeout;
  gate_requirements?: GateRequirements;
  debrief_config?: DebriefConfig;
  logging?: NodeLogging;
}

/* ------------------------------ Scenario --------------------------------- */

export interface Scenario {
  schema_version: string;
  scenario_meta: ScenarioMeta;
  initial_state: InitialState;
  hotspots: Hotspot[];
  ehr_config: EhrConfig;
  rules: Rules;
  nodes: ScenarioNode[];
  /**
   * Προαιρετικές αναγνώσιμες ετικέτες για τα flags κατάστασης — χρησιμοποιούνται
   * από την οθόνη Debrief (data-driven checklist τεκμηρίωσης/πρωτοκόλλου).
   */
  flag_labels?: Record<string, string>;
}

/* -------------------------------- Toasts --------------------------------- */

export type ToastStyle = 'info' | 'success' | 'danger' | 'warning';

export interface ToastMessage {
  id: number;
  message: string;
  style: ToastStyle;
}

/* ------------------------------- Logging --------------------------------- */

export type LogEventType =
  | 'NODE_ENTER'
  | 'HOTSPOT_INTERACTION'
  | 'OPTION_SELECTED'
  | 'EHR_SUBMIT'
  | 'VITALS_CHANGE'
  | 'GATE_BLOCKED'
  | 'GATE_PASSED'
  | 'TIMEOUT'
  | 'SCENARIO_START'
  | 'SCENARIO_END';

export interface LogEvent {
  seq: number;
  type: LogEventType;
  timestamp: string;
  elapsedMs: number;
  nodeId: string | null;
  label: string;
  /** Βαθμολογική επίδραση που σχετίζεται με το event (αν υπάρχει). */
  scoreDelta?: number;
  /** Σημασιολογία ορόσημου για το visual timeline. */
  outcome?: 'positive' | 'negative' | 'neutral';
  meta?: Record<string, unknown>;
}

/* ------------------------- Engine runtime state -------------------------- */

export type EngineStatus = 'selecting' | 'running' | 'ended';

export interface EngineState {
  status: EngineStatus;
  scenario: Scenario | null;
  currentNodeId: string | null;
  score: number;
  vitals: Vitals;
  flags: Record<string, boolean>;
  startedAt: number | null;
  timeElapsedMs: number;
  /** Ποιο hotspot modal είναι ανοιχτό (null = κανένα). */
  activeHotspot: string | null;
  ehrData: EhrData;
  log: LogEvent[];
  toasts: ToastMessage[];
  monitorAlert: boolean;
}
