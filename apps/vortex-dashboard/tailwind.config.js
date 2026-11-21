/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // N.O Group — AMOLED Pure Black Canvas
        canvas: '#000000',
        surface: '#090C10',
        border: '#161B22',
        // 6-stop gradient palette
        anchor: '#004BFF',
        iridescent: '#A38CFF',
        coral: '#FFA1C5',
        cyber: '#00D2FF',
        neon: '#00E6A6',
        tech: '#1BFF6B',
        // Interactive accents
        focus: '#3379FF',
        success: '#00FF66',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'vortex-spin': 'vortexSpin 20s linear infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        vortexSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropFilter: {
        'glass': 'blur(12px)',
        'glass-lg': 'blur(24px)',
      },
    },
  },
  plugins: [],
};
