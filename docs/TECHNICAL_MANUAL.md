# Τεχνικό Εγχειρίδιο (Ανάλυση & Σχεδίαση)
## Προσομοιωτής ΜΕΘ — Διαδραστική Κλινική Προσομοίωση

---

## 1. Επισκόπηση

Web εφαρμογή single-page που υλοποιεί έναν rule-based προσομοιωτή ΜΕΘ. Η ροή κάθε σεναρίου ορίζεται **δηλωτικά σε JSON** (decision tree) και εκτελείται από μια μηχανή κατάστασης (state machine) στον client. Δίνεται έμφαση σε αρχές HCI/UX: ορατότητα κατάστασης, ανατροφοδότηση, πρόληψη σφαλμάτων, ελαχιστοποίηση μνημονικού φορτίου.

## 2. Τεχνολογικό stack

| Στοιχείο | Τεχνολογία |
|---|---|
| UI library | React 18 |
| Build / dev server | Vite 5 |
| Γλώσσα | TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Γραφικά κυματομορφών | HTML5 Canvas (`requestAnimationFrame`) |
| Ήχος | Web Audio API |
| Κατάσταση | React `useReducer` + Context |

## 3. Δομή έργου

```
src/
├── App.tsx                     # Routing: selecting / running / ended
├── main.tsx                    # Entry point
├── index.css                   # Tailwind + clinical theme
├── types.ts                    # Τυποποίηση JSON σεναρίου + engine state
├── context/
│   └── ScenarioContext.tsx     # Μηχανή εκτέλεσης (reducer) — η «καρδιά»
├── data/
│   ├── scenario.json           # Σενάριο 1: Υποξαιμία (8 κόμβοι)
│   ├── level2.json             # Σενάριο 2: Σηπτικό Σοκ
│   └── ehrFields.ts            # Metadata & dropdown options πεδίων EHR
├── hooks/
│   └── useAlarmSound.ts        # Ακουστικός συναγερμός (Web Audio)
└── components/
    ├── ScenarioSelector.tsx    # Landing page (λίστα/φόρτωση/reset)
    ├── ICUWardView.tsx         # Σκηνή ΜΕΘ, hotspots, HUD, timeout, modals
    ├── VitalsMonitor.tsx       # Μόνιτορ ζωτικών + alarm
    ├── WaveformCanvas.tsx      # Ζωντανές κυματομορφές ECG/Pleth/Resp
    ├── EHRModal.tsx            # Φόρμες EHR + Documentation Gate + Status Card
    ├── FocusModal.tsx          # Γενικό modal εστίασης (blur, Esc)
    ├── HelpModal.tsx           # On-line help
    ├── Toasts.tsx              # Σύστημα ειδοποιήσεων
    └── DebriefScreen.tsx       # Score, timeline, decision path, export
```

## 4. Αρχιτεκτονική & ροή ελέγχου

```
ScenarioProvider (useReducer)
        │  state: { status, scenario, currentNodeId, score, vitals, flags,
        │           ehrData, log, toasts, monitorAlert, ... }
        ▼
   App / Router  ──► selecting → ScenarioSelector
                     running   → ICUWardView ──► FocusModal ──► EHRModal/...
                     ended     → DebriefScreen
        ▲
   actions (dispatch): START, SELECT_OPTION, GATE_ATTEMPT, FIRE_TIMEOUT,
                       UPDATE_EHR_FIELD, CONTINUE_MESSAGE, RESET, ...
```

Η μηχανή είναι **καθαρός reducer**: κάθε action παράγει νέα αμετάβλητη κατάσταση και, όπου χρειάζεται, καταχωρεί events στο `log`, εφαρμόζει `effects` και αξιολογεί τους **global rules**.

### 4.1 Τύποι κόμβων (nodes)

| Τύπος | Συμπεριφορά |
|---|---|
| `message` | Αφηγηματικό κείμενο + «Συνέχεια» → `next_node_id`. |
| `decision` | Επιλογές με `target_hotspot`, `effects`, προαιρετικό `timeout`. |
| `gate` | Μπλοκάρει τη ροή μέχρι να συμπληρωθούν `required_forms` στο EHR. |
| `end` | Τερματισμός → οθόνη Debrief. |

### 4.2 Effects & Rules

- **Option/Timeout effects:** `score_delta`, `state_update` (flags), `vitals_update`, `toast`.
- **Global rule (υποξαιμία):** `vitals.spo2 < 90` ⇒ `monitor_alert` (κόκκινο flash) + danger toast + ακουστικός συναγερμός.
- **Timeout:** μετρητής 30s· στη λήξη εφαρμόζονται `on_timeout_effects` και γίνεται μετάβαση.

## 5. Μοντέλο δεδομένων (JSON schema)

Κάθε σενάριο περιλαμβάνει: `scenario_meta`, `initial_state` (vitals, flags, ui), `hotspots`, `ehr_config.forms`, `rules.global_rules`, `nodes[]` και (προαιρετικά) `flag_labels` για το data-driven debrief.

> Πλήρες παράδειγμα: [`src/data/scenario.json`](../src/data/scenario.json). Δεύτερο σενάριο: [`src/data/level2.json`](../src/data/level2.json).

**Επεκτασιμότητα:** Νέο σενάριο προστίθεται **μόνο** με νέο JSON — είτε με «Φόρτωση JSON» από την αρχική, είτε με προσθήκη import στο `App.tsx`. Δεν απαιτείται αλλαγή λογικής, αρκεί τα `target_hotspot` και τα EHR `fields` να αντιστοιχούν σε υπαρκτά ids (βλ. `ehrFields.ts`).

## 6. e-Health module (EHR) & Documentation Gates

- Οι φόρμες παράγονται **δυναμικά** από το `ehr_config`.
- Όλα τα πεδία είναι **dropdowns** με κλινικές επιλογές (KLM optimization / Error Prevention).
- **Patient Status Card:** δυναμική κλινική εικόνα (Recognition rather than Recall) με «προτεινόμενη καταχώρηση» που ταυτίζεται με τα `<option>` — υπάρχει ειδικός resolver για το σενάριο υποξαιμίας και γενικός resolver (αιμοδυναμική/σηπτική εικόνα) για τα υπόλοιπα.
- **Gate validation:** `getMissingGateFields()` ελέγχει τα `required_forms`. Αν λείπουν, εμφανίζεται toast και η έξοδος μπλοκάρει· αλλιώς εφαρμόζονται `effects_on_pass`.

## 7. Καταγραφή & Απολογισμός (Logging & Debrief)

- **Action Log:** καταγράφονται `NODE_ENTER`, `OPTION_SELECTED`, `HOTSPOT_INTERACTION`, `EHR_SUBMIT`, `VITALS_CHANGE`, `GATE_PASSED/BLOCKED`, `TIMEOUT` με timestamp, elapsed, nodeId, scoreDelta, outcome.
- **Debrief (data-driven):** Score ring (ποσοστό επί του μέγιστου εφικτού), checklist από τα `flags` (ετικέτες από `flag_labels`), **Visual Timeline** με hover, **Decision Path**, **Export JSON/CSV**.

## 8. Σχεδιαστικές αποφάσεις UI/UX

- **Σκηνή:** front-facing 2.5D με φωτογραφικό φόντο και απόλυτα τοποθετημένα hotspots (`HOTSPOT_POSITIONS` σε %). Επιλέχθηκε αντί πλήρους 3D για αμεσότητα, απόδοση στον browser και ευθυγράμμιση pixel με το asset — διατηρώντας την αίσθηση **Direct Manipulation** (κλικ απευθείας πάνω στα αντικείμενα). Η σημείωση της εκφώνησης επιτρέπει υλοποίηση ως ιστοσελίδα.
- **Χρωματικός κώδικας:** cyan = καθοδήγηση, green = επιτυχία, amber = προσοχή/πύλη, red = συναγερμός/σφάλμα.
- **Live μόνιτορ:** ενσωματωμένο μέσα στην οθόνη τοίχου με Canvas waveforms — η ίδια οθόνη «λειτουργεί» μέσα στο δωμάτιο.

## 9. Αντιστοίχιση με αρχές HCI

| Αρχή | Υλοποίηση |
|---|---|
| Visibility of system status | HUD (score/χρόνος/events), alarms, timeout bar, toasts |
| Feedback | Άμεσα toasts & οπτικές αλλαγές σε κάθε ενέργεια |
| Error Prevention | Documentation Gates, dropdowns αντί ελεύθερου κειμένου |
| Recognition rather than Recall | Patient Status Card + glow στα καθοδηγούμενα hotspots |
| User Control & Freedom | Esc, Reset, mute ήχου, «Νέα Προσομοίωση» |

## 10. Ιεραρχική Ανάλυση Εργασιών (Ζητούμενο Β)

Η πλήρης HTA της λειτουργίας «Τεκμηρίωση παρέμβασης στο EHR» (αποσύνθεση + Plans + διάγραμμα) βρίσκεται στο ξεχωριστό αρχείο: **[`HTA_EHR_Documentation.md`](HTA_EHR_Documentation.md)**.

## 11. Εκτέλεση & Build

```bash
npm install
npm run dev       # development (http://localhost:5173)
npm run build     # production build (tsc -b && vite build) → dist/
npm run preview   # προεπισκόπηση build
```
