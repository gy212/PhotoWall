/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      colors: {
        // 新UI设计主色
        primary: {
          DEFAULT: '#007aff',
          light: '#e6f2ff',
          dark: '#005ec4',
          100: '#e5f2ff',
          900: '#005ec4',
        },
        // 新UI设计强调色
        accent: {
          DEFAULT: '#7DA0C0',
          hover: '#93B2CE',
          bg: 'rgba(125, 160, 192, 0.15)'
        },
        navy: {
          900: '#0f172a',
        },
        // 背景色
        background: {
          DEFAULT: 'var(--bg-base)',
          light: '#f8f9fc',
          dark: '#101922',
        },
        sidebar: 'var(--bg-sidebar)',
        surface: 'var(--bg-surface)',
        // 文本颜色
        'on-surface': 'var(--text-primary)',
        'on-surface-variant': 'var(--text-secondary)',
        // 边框颜色
        outline: 'var(--border-color)',
        border: 'var(--border-color)',
        // 按钮颜色
        button: 'var(--bg-element)',
        // 语义色
        secondary: {
          DEFAULT: 'var(--text-secondary)',
          foreground: 'var(--text-primary)',
        },
        muted: {
          DEFAULT: 'var(--text-tertiary)',
          foreground: 'var(--text-tertiary)',
        },
        // 特殊颜色
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        full: '9999px',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
};
