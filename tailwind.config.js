/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,ts,jsx,tsx}',
    './electron/**/*.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        // LCK — Coréen méthodique (bleu foncé)
        lck: {
          bg: '#0A1628',
          text: '#7FB3F5',
          accent: '#4A9FFF',
          border: '#1E3A5F'
        },
        // LEC — Européen analytique (violet)
        lec: {
          bg: '#1A0A2E',
          text: '#C4A0FF',
          accent: '#9B6EF3',
          border: '#3D1F6B'
        },
        // LCS — Nord-américain décontracté (rouge)
        lcs: {
          bg: '#1A0A0A',
          text: '#FF6B6B',
          accent: '#FF3B3B',
          border: '#5C1A1A'
        },
        // LPL — Chinois agressif (orange)
        lpl: {
          bg: '#1A0A00',
          text: '#FFB347',
          accent: '#FF8C00',
          border: '#5C2800'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-out': 'fadeOut 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
