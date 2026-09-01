/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', '"Trebuchet MS"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        md: '0.85rem',
        lg: '1.25rem',
        xl: '1.6rem',
        '2xl': '2rem',
      },
      colors: {
        // Brand: the punch pink accent of THE THING.
        brand: {
          50: '#fff0f6',
          100: '#ffe1ec',
          200: '#ffc3d9',
          300: '#ff9ebf',
          400: '#ff77a5',
          500: '#ff4d8d',
          600: '#e6296f',
          700: '#bd1857',
          800: '#8f1142',
          900: '#690c31',
        },
        // Ink: the near-black void, used for type on cream and for solid tiles.
        ink: {
          DEFAULT: '#120b26',
          900: '#120b26',
          800: '#1a1136',
          700: '#251850',
          600: '#3d2f5e',
          500: '#5b4a7d',
          400: '#7a6b98',
          300: '#a396bd',
        },
        cream: {
          DEFAULT: '#fff4e4',
          deep: '#fbead1',
        },
        void: {
          950: '#120b26',
          900: '#1a1136',
          800: '#251850',
          700: '#342163',
        },
        punch: '#ff4d8d',
        zap: '#ffd23f',
        mint: '#3fe0a0',
        sky: '#4cc9f0',
        tang: '#ff8a3d',
        lilac: '#b79cff',
        paper: '#120b26',
      },
      boxShadow: {
        // Hard, non-blurred offset shadows - the signature of this design.
        soft: '4px 4px 0 0 #120b26',
        lift: '6px 6px 0 0 #120b26',
        glow: '8px 8px 0 0 #120b26',
        inset: 'none',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.6s ease both',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2s infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite',
      },
    },
  },
  plugins: [],
}
