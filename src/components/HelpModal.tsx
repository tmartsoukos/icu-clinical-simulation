/**
 * HelpModal.tsx
 * -----------------------------------------------------------------------------
 * On-line Help — διαθέσιμη τρέχοντας την εφαρμογή (Παραδοτέο #3). Εξηγεί τον
 * σκοπό, τον τρόπο παιχνιδιού, τα στοιχεία της σκηνής, τους χρωματικούς κώδικες,
 * τα Documentation Gates και τη βαθμολογία/απολογισμό.
 * -----------------------------------------------------------------------------
 */

import FocusModal from './FocusModal';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-clinical-border bg-black/20 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-clinical-cyan">
        <span className="text-base">{icon}</span>
        {title}
      </h3>
      <div className="space-y-1.5 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-clinical-border bg-black/30 px-2 py-1 text-xs text-slate-300">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <FocusModal
      title="Οδηγίες & On-line Βοήθεια"
      subtitle="Πώς λειτουργεί η προσομοίωση ΜΕΘ"
      accent="cyan"
      onClose={onClose}
      widthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <Section icon="🎯" title="Σκοπός">
          <p>
            Διαχειρίζεσαι κλινικά περιστατικά σε Μονάδα Εντατικής Θεραπείας μέσω ενός σεναρίου που εξελίσσεται με
            βάση τις αποφάσεις σου. Δεν απαιτείται ιατρική γνώση — τα ζωτικά σημεία είναι μεταβλητές του σεναρίου.
          </p>
        </Section>

        <Section icon="🕹️" title="Πώς παίζεται (βήμα-βήμα)">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Διάβασε το πλαίσιο ενημέρωσης (briefing) στο κάτω μέρος της οθόνης.</li>
            <li>
              Σε κόμβο <span className="text-clinical-cyan">απόφασης</span> κάνε κλικ σε ένα από τα{' '}
              <span className="text-clinical-cyan">φωτισμένα στοιχεία</span> της σκηνής (pulse rings / οθόνες).
            </li>
            <li>Στο παράθυρο εστίασης επίλεξε την ενέργεια που θες να εκτελέσεις.</li>
            <li>
              Σε κόμβο <span className="text-clinical-amber">πύλης (gate)</span> άνοιξε το Τερματικό EHR και
              συμπλήρωσε τα υποχρεωτικά πεδία για να συνεχίσεις.
            </li>
            <li>Στο τέλος βλέπεις την οθόνη απολογισμού (debrief) με score, διαδρομή & export.</li>
          </ol>
        </Section>

        <Section icon="🧭" title="Στοιχεία σκηνής (Hotspots)">
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <li>🖥️ <b>Μόνιτορ</b> — ζωτικά σημεία & κυματομορφές</li>
            <li>🛏️ <b>Ασθενής/Κλίνη</b> — κλινική επισκόπηση</li>
            <li>🫁 <b>Αναπνευστήρας</b> — ρυθμίσεις οξυγόνου</li>
            <li>📋 <b>Τερματικό EHR</b> — ψηφιακή τεκμηρίωση</li>
            <li>🔔 <b>Κουμπί Κλήσης</b> — κλιμάκωση/κλήση ιατρού</li>
          </ul>
        </Section>

        <Section icon="🎨" title="Χρωματικοί κώδικες & ενδείξεις">
          <div className="flex flex-wrap gap-2">
            <Legend color="bg-clinical-cyan" label="Καθοδηγούμενη ενέργεια (ping)" />
            <Legend color="bg-clinical-danger" label="Συναγερμός / σφάλμα" />
            <Legend color="bg-clinical-green" label="Επιτυχία / σταθεροποίηση" />
            <Legend color="bg-clinical-amber" label="Προσοχή / πύλη" />
          </div>
          <p className="pt-1">
            Όταν το SpO₂ πέσει &lt; 90% ενεργοποιείται οπτικός (κόκκινο flash) και ακουστικός συναγερμός. Ο ήχος
            μπορεί να γίνει mute από το κουμπί 🔊/🔇 στη μπάρα HUD.
          </p>
        </Section>

        <Section icon="🔒" title="Documentation Gates">
          <p>
            Σε κρίσιμα σημεία η ροή <b>μπλοκάρει</b> μέχρι να καταχωρηθεί η τεκμηρίωση στο EHR. Τα υποχρεωτικά πεδία
            επισημαίνονται με κόκκινο και αστερίσκο (*). Το «Patient Status Card» σου δείχνει live την κλινική εικόνα
            ώστε να επιλέξεις σωστά (Recognition rather than Recall).
          </p>
        </Section>

        <Section icon="🏁" title="Βαθμολογία & Απολογισμός">
          <p>
            Κάθε σωστή ενέργεια προσθέτει πόντους· καθυστερήσεις (timeout) και λάθος επιλογές αφαιρούν. Στο τέλος
            βλέπεις score, visual timeline, διαδρομή αποφάσεων, τι τεκμηριώθηκε/παραλείφθηκε, και κουμπιά εξαγωγής
            (Export JSON/CSV).
          </p>
        </Section>

        <Section icon="⌨️" title="Συντομεύσεις & χειρισμός">
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Esc</b> — κλείσιμο ανοιχτού παραθύρου.</li>
            <li><b>⟲ Reset</b> (HUD) — επαναφορά κατάστασης & επιστροφή στην αρχή.</li>
            <li><b>Φόρτωση JSON</b> (αρχική) — πρόσθεσε δικό σου σενάριο χωρίς αλλαγή κώδικα.</li>
          </ul>
        </Section>
      </div>
    </FocusModal>
  );
}
