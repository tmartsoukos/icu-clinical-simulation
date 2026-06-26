/**
 * EHRModal.tsx
 * -----------------------------------------------------------------------------
 * Τερματικό e-Health (EHR). Παράγει ΔΥΝΑΜΙΚΑ τις φόρμες βάσει του ehr_config:
 *  - Κλινική Αξιολόγηση (assessment_form)
 *  - Παρεμβάσεις / Ρυθμίσεις (intervention_form)
 *  - Ημερολόγιο Επικοινωνίας (communication_log)
 * Όλα τα πεδία είναι dropdowns (KLM optimization / Error Prevention).
 * Σε κόμβο τύπου "gate" εφαρμόζεται ο μηχανισμός Documentation Gate: η συνέχεια
 * μπλοκάρεται μέχρι να συμπληρωθούν τα υποχρεωτικά πεδία.
 * -----------------------------------------------------------------------------
 */

import { useMemo, useState } from 'react';
import { getMissingGateFields, useScenario } from '../context/ScenarioContext';
import { getFieldMeta } from '../data/ehrFields';
import type { EhrFormDef, Vitals } from '../types';

type TabId = string;

/* ----------------------------------------------------------------------------
 * Patient Status Card — "Recognition rather than Recall"
 * ----------------------------------------------------------------------------
 * Δυναμική κλινική εικόνα βάσει της τρέχουσας κατάστασης (vitals / flags / node)
 * ώστε ο χρήστης να ΑΝΑΓΝΩΡΙΖΕΙ τι να καταχωρήσει αντί να θυμάται/μαντεύει.
 * Οι προτεινόμενες τιμές ταυτίζονται ΑΚΡΙΒΩΣ με τα <option> των dropdowns.
 * --------------------------------------------------------------------------*/
type ClinicalTone = 'warning' | 'danger' | 'success';

interface ClinicalPicture {
  tone: ClinicalTone;
  icon: string;
  text: string;
  suggest: { skin: string; consciousness: string; observation: string };
}

function hypoxiaPicture(
  spo2: number,
  flags: Record<string, boolean>,
  nodeId: string | null,
): ClinicalPicture {
  const stabilized =
    flags['oxygen_adjusted'] === true ||
    spo2 >= 92 ||
    nodeId === 'n5_reassessment' ||
    nodeId === 'n6_escalation_decision' ||
    nodeId === 'n7_gate_documentation_2';

  if (stabilized) {
    return {
      tone: 'success',
      icon: '✅',
      text: 'Σταθεροποίηση: Το SpO₂ ανέκαμψε στο 94%. Το χρώμα του δέρματος επανέρχεται σε φυσιολογικό/ροδόχρουν, ο ασθενής είναι ήρεμος και σε πλήρη επικοινωνία.',
      suggest: {
        skin: 'Φυσιολογικό / Ροδόχρουν',
        consciousness: 'Ήρεμος / Πλήρης επικοινωνία',
        observation: 'Φυσιολογική αναπνευστική εικόνα',
      },
    };
  }

  if (spo2 <= 86) {
    return {
      tone: 'danger',
      icon: '🚨',
      text: 'ΚΡΙΣΙΜΗ ΚΑΤΑΣΤΑΣΗ: Ο ασθενής βρίσκεται σε προ-σοκ κατάσταση λόγω καθυστέρησης. Το δέρμα είναι ωχρό/ιδρωμένο και το επίπεδο συνείδησης πέφτει σε συγχυτική κατάσταση/υπνηλία.',
      suggest: {
        skin: 'Ωχρό / Ιδρωμένο',
        consciousness: 'Συγχυτικός / Υπνηλία',
        observation: 'Εφίδρωση & ανησυχία',
      },
    };
  }

  return {
    tone: 'warning',
    icon: '⚠️',
    text: 'Παρατήρηση: Ξαφνική δύσπνοια. Αντικειμενικά ευρήματα: Έντονη κυάνωση (μπλε χρωματισμός δέρματος), ο ασθενής είναι ταχυπνοϊκός αλλά διατηρεί πλήρως τις αισθήσεις του.',
    suggest: {
      skin: 'Κυανωτικό (κυάνωση)',
      consciousness: 'Σε εγρήγορση (Alert)',
      observation: 'Δύσπνοια & κυάνωση',
    },
  };
}

/** Γενικός resolver για σενάρια εκτός υποξαιμίας (π.χ. σηπτικό σοκ). */
function genericPicture(vitals: Vitals, _flags: Record<string, boolean>): ClinicalPicture {
  void _flags;
  const systolic = parseInt(vitals.bp, 10) || 0;

  if (vitals.spo2 < 90) {
    return {
      tone: 'danger',
      icon: '🚨',
      text: 'ΣΥΝΑΓΕΡΜΟΣ ΥΠΟΞΑΙΜΙΑΣ: Ο κορεσμός οξυγόνου είναι κρίσιμα χαμηλός. Εμφανής κυάνωση και αναπνευστική δυσχέρεια.',
      suggest: {
        skin: 'Κυανωτικό (κυάνωση)',
        consciousness: 'Σε εγρήγορση (Alert)',
        observation: 'Δύσπνοια & κυάνωση',
      },
    };
  }

  if (systolic > 0 && systolic < 90) {
    return {
      tone: 'danger',
      icon: '🚨',
      text: `ΑΙΜΟΔΥΝΑΜΙΚΗ ΑΣΤΑΘΕΙΑ: Υπόταση (${vitals.bp} mmHg) με ταχυκαρδία (${vitals.hr} bpm)${
        vitals.temp >= 38.5 ? ` και υψηλό πυρετό (${vitals.temp.toFixed(1)}°C)` : ''
      }. Εικόνα συμβατή με σηπτικό σοκ — απαιτείται άμεση υποστήριξη.`,
      suggest: {
        skin: 'Ωχρό / Ιδρωμένο',
        consciousness: 'Σε εγρήγορση (Alert)',
        observation: 'Εφίδρωση & ανησυχία',
      },
    };
  }

  if (vitals.hr > 125 || vitals.temp >= 38.5) {
    return {
      tone: 'warning',
      icon: '⚠️',
      text: `Ασταθής εικόνα: ταχυκαρδία (${vitals.hr} bpm)${
        vitals.temp >= 38.5 ? ` και πυρετός (${vitals.temp.toFixed(1)}°C)` : ''
      }. Στενή παρακολούθηση και τεκμηρίωση των ευρημάτων.`,
      suggest: {
        skin: 'Ωχρό / Ιδρωμένο',
        consciousness: 'Σε εγρήγορση (Alert)',
        observation: 'Εφίδρωση & ανησυχία',
      },
    };
  }

  return {
    tone: 'success',
    icon: '✅',
    text: `Σταθερή εικόνα: τα ζωτικά σημεία βρίσκονται εντός αποδεκτών ορίων (BP ${vitals.bp}, HR ${vitals.hr}, SpO₂ ${vitals.spo2}%). Καταγράψτε την τρέχουσα αξιολόγηση.`,
    suggest: {
      skin: 'Φυσιολογικό / Ροδόχρουν',
      consciousness: 'Ήρεμος / Πλήρης επικοινωνία',
      observation: 'Φυσιολογική αναπνευστική εικόνα',
    },
  };
}

/** Επιλέγει τον κατάλληλο resolver κλινικής εικόνας ανά σενάριο. */
function getClinicalPicture(
  scenarioId: string,
  vitals: Vitals,
  flags: Record<string, boolean>,
  nodeId: string | null,
): ClinicalPicture {
  if (scenarioId === 'icu_scenario_hypoxia_v1') return hypoxiaPicture(vitals.spo2, flags, nodeId);
  return genericPicture(vitals, flags);
}

const TONE_STYLES: Record<ClinicalTone, { box: string; title: string; chip: string }> = {
  warning: {
    box: 'border-clinical-amber/40 bg-clinical-amber/10',
    title: 'text-clinical-amber',
    chip: 'border-clinical-amber/40 bg-clinical-amber/10 text-clinical-amber',
  },
  danger: {
    box: 'border-clinical-danger/50 bg-clinical-danger/10 shadow-glow-danger',
    title: 'text-clinical-danger',
    chip: 'border-clinical-danger/40 bg-clinical-danger/10 text-clinical-danger',
  },
  success: {
    box: 'border-clinical-green/40 bg-clinical-green/10',
    title: 'text-clinical-green',
    chip: 'border-clinical-green/40 bg-clinical-green/10 text-clinical-green',
  },
};

function PatientStatusCard() {
  const { state } = useScenario();
  const spo2 = state.vitals.spo2;
  const picture = getClinicalPicture(
    state.scenario!.scenario_meta.id,
    state.vitals,
    state.flags,
    state.currentNodeId,
  );
  const s = TONE_STYLES[picture.tone];

  return (
    <div className={`animate-fade-in rounded-xl border p-4 ${s.box}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={`text-sm font-bold tracking-wide ${s.title}`}>🚨 Τρέχουσα Κλινική Εικόνα Ασθενούς</p>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${s.chip}`}>
          SpO₂ {spo2}%
        </span>
      </div>

      <p className="flex gap-2 text-sm leading-relaxed text-slate-200">
        <span className="text-base leading-none">{picture.icon}</span>
        <span>{picture.text}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Προτεινόμενη καταχώρηση:
        </span>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.chip}`}>
          Δέρμα: {picture.suggest.skin}
        </span>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.chip}`}>
          Συνείδηση: {picture.suggest.consciousness}
        </span>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.chip}`}>
          Εύρημα: {picture.suggest.observation}
        </span>
      </div>
    </div>
  );
}

export default function EHRModal() {
  const { state, currentNode, updateEhrField, submitEhrForm, attemptGate } = useScenario();
  const scenario = state.scenario!;
  const forms = scenario.ehr_config.forms;
  const formIds = Object.keys(forms);
  const [activeTab, setActiveTab] = useState<TabId>(formIds[0]);

  const gateReq = currentNode?.type === 'gate' ? currentNode.gate_requirements : undefined;

  // Σύνολο υποχρεωτικών πεδίων ανά φόρμα (για highlight).
  const requiredMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    if (gateReq) {
      for (const rf of gateReq.required_forms) {
        map[rf.form_id] = new Set(rf.fields);
      }
    }
    return map;
  }, [gateReq]);

  const missing = gateReq ? getMissingGateFields(gateReq, state.ehrData) : [];
  const missingByForm = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const item of missing) {
      if (!m[item.form_id]) m[item.form_id] = new Set();
      m[item.form_id].add(item.field);
    }
    return m;
  }, [missing]);

  const isFormComplete = (formId: string): boolean => {
    const req = requiredMap[formId];
    if (!req || req.size === 0) return false;
    return !missingByForm[formId] || missingByForm[formId].size === 0;
  };

  const renderForm = (formId: string, def: EhrFormDef) => {
    const data = state.ehrData[formId] ?? {};
    const reqFields = requiredMap[formId] ?? new Set<string>();

    return (
      <div className="animate-fade-in space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-clinical-cyan">{def.title}</h3>
          {reqFields.size > 0 && (
            <span className="rounded-full border border-clinical-amber/40 bg-clinical-amber/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-amber">
              Απαιτείται για το Gate
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {def.fields.map((field) => {
            const meta = getFieldMeta(field);
            const value = data[field] ?? '';
            const isRequired = reqFields.has(field);
            const isMissing = !!missingByForm[formId]?.has(field);

            return (
              <label key={field} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-300">
                  {meta.label}
                  {isRequired && <span className="text-clinical-danger">*</span>}
                </span>
                <select
                  value={value}
                  onChange={(e) => updateEhrField(formId, field, e.target.value)}
                  className={`rounded-lg border bg-clinical-panel2 px-3 py-2.5 text-sm text-slate-100 outline-none transition-all focus:border-clinical-cyan focus:shadow-glow ${
                    isMissing
                      ? 'border-clinical-danger/70 shadow-glow-danger'
                      : value
                        ? 'border-clinical-green/40'
                        : 'border-clinical-border'
                  }`}
                >
                  <option value="">{meta.placeholder}</option>
                  {meta.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => submitEhrForm(formId, def.title)}
            className="rounded-lg border border-clinical-cyan/40 bg-clinical-cyan/10 px-4 py-2 text-sm font-semibold text-clinical-cyan transition-all hover:bg-clinical-cyan/20"
          >
            💾 Αποθήκευση Φόρμας
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Patient Status Card — Recognition rather than Recall */}
      <PatientStatusCard />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-clinical-border pb-3">
        {formIds.map((fid) => {
          const isActive = fid === activeTab;
          const complete = isFormComplete(fid);
          const hasReq = (requiredMap[fid]?.size ?? 0) > 0;
          return (
            <button
              key={fid}
              onClick={() => setActiveTab(fid)}
              className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-clinical-cyan/15 text-clinical-cyan shadow-glow'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {hasReq && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    complete ? 'bg-clinical-green' : 'bg-clinical-danger animate-blink'
                  }`}
                  title={complete ? 'Συμπληρωμένο' : 'Εκκρεμεί'}
                />
              )}
              {forms[fid].title}
            </button>
          );
        })}
      </div>

      {/* Active form */}
      {renderForm(activeTab, forms[activeTab])}

      {/* Gate footer */}
      {gateReq && (
        <div className="mt-2 rounded-xl border border-clinical-amber/30 bg-clinical-amber/5 p-4">
          <div className="mb-3 flex items-start gap-2">
            <span className="text-lg">🔒</span>
            <div>
              <p className="text-sm font-semibold text-clinical-amber">Documentation Gate</p>
              <p className="text-xs text-slate-400">
                {missing.length > 0
                  ? `Εκκρεμούν ${missing.length} υποχρεωτικά πεδία πριν την έξοδο.`
                  : 'Όλα τα υποχρεωτικά πεδία συμπληρώθηκαν. Μπορείτε να συνεχίσετε.'}
              </p>
            </div>
          </div>
          <button
            onClick={attemptGate}
            disabled={missing.length > 0}
            className={`w-full rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all ${
              missing.length > 0
                ? 'cursor-not-allowed border border-clinical-border bg-black/30 text-slate-600'
                : 'border border-clinical-green/50 bg-clinical-green/15 text-clinical-green shadow-glow-green hover:bg-clinical-green/25'
            }`}
          >
            {missing.length > 0 ? '🔒 Συμπληρώστε τα υποχρεωτικά πεδία' : '✓ Επικύρωση & Συνέχεια'}
          </button>
        </div>
      )}
    </div>
  );
}
