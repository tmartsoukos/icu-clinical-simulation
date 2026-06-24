/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        clinical: {
          bg: '#070b14',
          panel: '#0d1424',
          panel2: '#111a2e',
          border: '#1c2942',
          cyan: '#22d3ee',
          green: '#34f5a0',
          amber: '#fbbf24',
          danger: '#ff3b4e',
          muted: '#5b6b88',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.4), 0 0 22px rgba(34,211,238,0.35)',
        'glow-green': '0 0 0 1px rgba(52,245,160,0.4), 0 0 22px rgba(52,245,160,0.35)',
        'glow-danger': '0 0 0 1px rgba(255,59,78,0.5), 0 0 26px rgba(255,59,78,0.45)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(34,211,238,0.35), 0 0 10px rgba(34,211,238,0.25)' },
          '50%': { boxShadow: '0 0 0 2px rgba(34,211,238,0.7), 0 0 28px rgba(34,211,238,0.6)' },
        },
        'pulse-glow-danger': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(255,59,78,0.4), 0 0 10px rgba(255,59,78,0.3)' },
          '50%': { boxShadow: '0 0 0 2px rgba(255,59,78,0.9), 0 0 34px rgba(255,59,78,0.75)' },
        },
        'blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0.25' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
        'pulse-glow-danger': 'pulse-glow-danger 0.9s ease-in-out infinite',
        'blink': 'blink 0.8s step-end infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.22s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
