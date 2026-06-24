# Προσομοιωτής ΜΕΘ — Κλινική Λήψη Αποφάσεων (HCI)

Διαδραστική web εφαρμογή κλινικής προσομοίωσης σε περιβάλλον ΜΕΘ. Υλοποιεί
σενάριο διαχείρισης υποξαιμίας με Focus-Based UI, documentation gates, action
logging και debrief — βασισμένο σε JSON σενάριο.

**Stack:** React 18 · Vite · TypeScript · Tailwind CSS

## Εκτέλεση

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build στο dist/
npm run preview  # προεπισκόπηση του build
```

## Αρχιτεκτονική

| Αρχείο | Ρόλος |
| --- | --- |
| `src/types.ts` | Τυποποίηση JSON σεναρίου + engine state, logging, EHR |
| `src/data/scenario.json` | Το σενάριο (φορτώνεται· υποστηρίζεται και custom upload) |
| `src/data/ehrFields.ts` | Dropdown επιλογές & ετικέτες πεδίων EHR (KLM optimization) |
| `src/context/ScenarioContext.tsx` | Μηχανή εκτέλεσης (reducer): πλοήγηση κόμβων, score, vitals, flags, global rules, gate validation, logging |
| `src/components/ScenarioSelector.tsx` | Landing page (meta, στόχοι, JSON load, reset) |
| `src/components/ICUWardView.tsx` | Κύρια σκηνή: 2.5D θάλαμος, hotspots+glow, blur, timeout bar, HUD, focus modals |
| `src/components/WaveformCanvas.tsx` | Ζωντανές κυματομορφές ECG/Pleth/Resp (HTML5 Canvas) |
| `src/components/VitalsMonitor.tsx` | Μόνιτορ ζωτικών + alarm υποξαιμίας |
| `src/components/EHRModal.tsx` | Δυναμικές φόρμες EHR + Documentation Gate |
| `src/components/FocusModal.tsx` | Γενικό focus modal (ESC, backdrop) |
| `src/components/Toasts.tsx` | Ειδοποιήσεις / error prevention |
| `src/components/DebriefScreen.tsx` | Score, visual timeline, decision path, export JSON/CSV |
| `src/App.tsx` | Routing μεταξύ selecting / running / ended |

## Χαρτογράφηση απαιτήσεων HCI

- **Recognition rather than Recall** — glow animation σε καθοδηγούμενα hotspots.
- **Error Prevention** — dropdowns αντί ελεύθερου κειμένου, documentation gates με toasts.
- **KLM optimization** — όλα τα πεδία είναι selects με κλινικές επιλογές.
- **Visibility of system status** — HUD (score/χρόνος/events), alarms, timeout bar.
- **Feedback & Debrief** — πλήρες action log, visual timeline, export.
