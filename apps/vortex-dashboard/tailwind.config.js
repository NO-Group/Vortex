/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── N.O Group brand tokens (Pure Dark Canvas Edition) ──
        canvas: '#000000',
        surface: '#090C10',
        stroke: '#161B22',
        spectrum: {
          blue: '#004BFF',
          lavender: '#A38CFF',
          coral: '#FFA1C5',
          cyan: '#00D2FF',
          mint: '#00E6A6',
          green: '#1BFF6B',
        },
        interactive: {
          focus: '#3379FF',
          success: '#00FF66',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SF Mono',
          'JetBrains Mono',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'grid-drift': {
          '0%': { backgroundPosition: '0 0, 0 0' },
          '100%': { backgroundPosition: '40px 40px, 40px 40px' },
        },
        'ripple-pulse': {
          '0%': { transform: 'scale(0.6)', opacity: '0.35' },
          '80%': { transform: 'scale(2.4)', opacity: '0' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'status-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 currentColor' },
          '50%': { opacity: '0.75', boxShadow: '0 0 8px 1px currentColor' },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.85' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'grid-drift': 'grid-drift 60s linear infinite',
        'ripple-pulse': 'ripple-pulse 7s ease-out infinite',
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'glow-breathe': 'glow-breathe 8s ease-in-out infinite',
        'fade-in': 'fade-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
