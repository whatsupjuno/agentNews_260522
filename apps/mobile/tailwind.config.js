/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Apple HIG iOS 17 풍 — design-brief §5
        bg: '#f5f5f7',
        surface: '#ffffff',
        textPrimary: '#1d1d1f',
        textSecondary: '#86868b',
        accent: '#007aff',
        success: '#34c759',
        warning: '#ff9500',
        danger: '#ff453a',
        bubbleMe: '#007aff',
        bubblePeer: '#e9e9eb',
      },
      borderRadius: {
        card: '12px',
        modal: '18px',
        bubble: '22px',
      },
      fontFamily: {
        sf: ['"SF Pro Text"', 'system-ui', 'sans-serif'],
        sfDisplay: ['"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
