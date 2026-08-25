/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f5fb',
          100: '#dce8f4',
          200: '#b9d0e9',
          300: '#8fb0d8',
          400: '#5e88c4',
          500: '#3d6aaf',
          600: '#2d5290',
          700: '#244275',
          800: '#1b325c',
          900: '#142546',
          950: '#0c1830',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dde1e9',
          300: '#c2c9d6',
          400: '#9aa3b5',
          500: '#6b7588',
          600: '#4d566a',
          700: '#3a4256',
          800: '#272d40',
          900: '#1a1f2e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16, 24, 40, 0.04), 0 1px 3px 0 rgba(16, 24, 40, 0.06)',
        'card-hover': '0 4px 12px -2px rgba(16, 24, 40, 0.08), 0 2px 6px -2px rgba(16, 24, 40, 0.04)',
        pop: '0 12px 32px -8px rgba(12, 24, 48, 0.18), 0 4px 12px -4px rgba(12, 24, 48, 0.10)',
      },
      keyframes: {
        'pulse-alert': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(220, 38, 38, 0.5)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 0 8px rgba(220, 38, 38, 0)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-out': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(120%)' },
        },
        'qr-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(45, 82, 144, 0.4)' },
          '50%': { boxShadow: '0 0 0 10px rgba(45, 82, 144, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-alert': 'pulse-alert 1.6s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'toast-out': 'toast-out 0.3s ease-in forwards',
        'qr-pulse': 'qr-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
      },
    },
  },
  plugins: [],
};
