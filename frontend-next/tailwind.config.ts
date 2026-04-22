import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#185fa5',
          hover: '#0c447c',
          light: '#e6f1fb',
          mid: '#b3d1f0',
        },
        success: {
          DEFAULT: '#1d9e75',
          light: '#e1f5ee',
          text: '#0f6e56',
        },
        danger: {
          DEFAULT: '#e24b4a',
          light: '#fcebeb',
          text: '#a32d2d',
        },
        warn: {
          DEFAULT: '#d97706',
          light: '#fef3c7',
          text: '#854f0b',
        },
        bg: {
          primary: '#ffffff',
          secondary: '#f4f4f0',
          tertiary: '#eeeee9',
        },
        border: {
          primary: '#cbcac5',
          secondary: '#e2e2dc',
        },
        text: {
          primary: '#1a1a18',
          secondary: '#72716d',
          muted: '#a09f9b',
        },
        dot: {
          connected: '#1d9e75',
          disconnected: '#a09f9b',
          error: '#e24b4a',
          connecting: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Consolas', 'Monaco', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '10px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        md: '0 4px 12px rgba(0,0,0,.08)',
      },
      animation: {
        'pulse-danger': 'pulse-danger 1.5s infinite',
        'blink': 'blink 0.8s infinite',
        'slide-down': 'slide-down 0.3s ease',
      },
      keyframes: {
        'pulse-danger': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        blink: {
          '50%': { opacity: '0.3' },
        },
        'slide-down': {
          from: { transform: 'translateX(-50%) translateY(-20px)', opacity: '0' },
          to: { transform: 'translateX(-50%) translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
