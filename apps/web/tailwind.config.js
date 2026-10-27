/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f8fafc', // Institutional off-white (not pure white)
        canvas: '#f8fafc',
        surface: '#ffffff',
        card: '#ffffff',
        'card-hover': '#fcfcfd',
        subtle: '#f1f5f9',
        border: '#e2e8f0',
        'border-strong': '#cbd5e1',
        primary: {
          DEFAULT: '#dc2626', // ExamVault Crimson Red
          hover: '#b91c1c',
          light: '#fef2f2',
          border: '#fecaca',
          glow: 'rgba(220, 38, 38, 0.15)',
        },
        dark: {
          DEFAULT: '#0f172a', // Obsidian Black
          hover: '#1e293b',
          subtle: '#334155',
        },
        accent: {
          red: '#dc2626',
          black: '#0f172a',
          emerald: '#059669', // Status: Approved / Verified / Intact
          amber: '#d97706',   // Status: Pending / Review
          blue: '#2563eb',
          rose: '#e11d48',
        },
        text: {
          primary: '#0f172a',   // Deep obsidian high-contrast text
          secondary: '#475569', // Slate 600
          muted: '#64748b',     // Slate 500
          subtle: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        'card-hover': '0 10px 25px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
        'elevated': '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        'red-sm': '0 2px 8px rgba(220, 38, 38, 0.2)',
      },
    },
  },
  plugins: [],
};
