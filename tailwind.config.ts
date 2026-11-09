import type { Config } from 'tailwindcss';

// Design tokens from the Notion-inspired design system (green variant).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          100: '#F0FAF2',
          200: '#D0F4D8',
          300: '#ABE5B8',
          400: '#68CE7E',
          500: '#1AAE39',
          600: '#14832B',
          700: '#0F6220',
          800: '#0A4216',
          900: '#05210B',
        },
        ink: { DEFAULT: '#000000', soft: '#615d59', muted: '#78736f', faint: '#a39e98' },
        paper: { DEFAULT: '#ffffff', warm: '#f6f5f4', soft: '#f9f9f8' },
        line: 'rgba(0,0,0,0.1)',
        danger: '#F64932',
        warn: '#FF6D00',
        info: '#0075DE',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: { sm: '4px', md: '8px', lg: '12px', xl: '16px' },
      boxShadow: {
        // Notion card shadow (4 soft layers)
        card:
          'rgba(0,0,0,0.01) 0 0.175px 1.04px, rgba(0,0,0,0.02) 0 0.8px 2.93px, rgba(0,0,0,0.027) 0 2.025px 7.85px, rgba(0,0,0,0.04) 0 4px 18px',
        // Deep layered shadow for modals / popovers
        pop:
          'rgba(0,0,0,0.01) 0 1px 3px, rgba(0,0,0,0.02) 0 3px 7px, rgba(0,0,0,0.02) 0 7px 15px, rgba(0,0,0,0.04) 0 14px 28px, rgba(0,0,0,0.05) 0 23px 52px',
      },
      transitionDuration: { 100: '100ms', 200: '200ms' },
    },
  },
  plugins: [],
};

export default config;
