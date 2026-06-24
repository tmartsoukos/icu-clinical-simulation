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
import type { EhrFormDef } from '../types';

type TabId = string;

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
