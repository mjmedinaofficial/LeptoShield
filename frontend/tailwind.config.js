/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F7F4EE',
          50: '#FDFCF9',
          100: '#F3EFE7',
          200: '#E9E3D7',
          300: '#DCD4C4',
        },
        surface: '#FFFDF9',
        ink: {
          DEFAULT: '#1B2A27',
          soft: '#41524D',
          mute: '#6D7C77',
          faint: '#94A29D',
          line: '#E4DED2',
        },
        teal: {
          DEFAULT: '#0E6B62',
          deep: '#0B4F49',
          ink: '#0A3F3A',
          mid: '#3E8B81',
          soft: '#DCEBE6',
          mist: '#EFF5F2',
        },
        sage: {
          DEFAULT: '#E7EEE7',
          deep: '#CFDCD3',
        },
        clay: {
          DEFAULT: '#B23A32',
          deep: '#8E2C26',
          soft: '#F8E5E1',
          mist: '#FDF3F1',
        },
        ochre: {
          DEFAULT: '#B77A16',
          deep: '#8B5B0F',
          soft: '#F8EEDA',
          mist: '#FDF7EA',
        },
        moss: {
          DEFAULT: '#2F7D62',
          deep: '#245E4A',
          soft: '#E2F0E8',
          mist: '#F1F8F4',
        },
        night: {
          DEFAULT: '#12211E',
          soft: '#182D29',
          line: '#2A4640',
          text: '#EAF1EC',
          mute: '#A7BDB6',
        },
      },
      fontFamily: {
        sans: ['"Hanken Grotesk Variable"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4 Variable"', 'Georgia', 'Cambria', 'serif'],
        mono: ['"Roboto Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2.5xl': '1.375rem',
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(27,42,39,.04), 0 14px 34px -20px rgba(27,42,39,.30)',
        card: '0 1px 2px rgba(27,42,39,.05), 0 24px 52px -30px rgba(27,42,39,.34)',
        lift: '0 2px 6px rgba(27,42,39,.06), 0 40px 72px -36px rgba(27,42,39,.42)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.65)',
        night: '0 24px 60px -30px rgba(6,14,12,.75)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fill: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        pop: {
          '0%': { transform: 'scale(.95)', opacity: '.4' },
          '60%': { transform: 'scale(1.015)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        breathe: {
          '0%, 100%': { opacity: '.45' },
          '50%': { opacity: '1' },
        },
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        sweep: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.16,1,.3,1) both',
        fade: 'fade .4s ease-out both',
        fill: 'fill .7s cubic-bezier(.16,1,.3,1) both',
        pop: 'pop .45s cubic-bezier(.16,1,.3,1) both',
        breathe: 'breathe 2.6s ease-in-out infinite',
        bob: 'bob 3.2s ease-in-out infinite',
        ticker: 'ticker 42s linear infinite',
        sweep: 'sweep .45s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
};
