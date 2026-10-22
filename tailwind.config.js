/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wa: {
          green: '#25D366',
          teal: '#00A884',
          'quote-accent': '#06CF9C',
          'badge-red': '#EF4444',
          'panel-bg': '#111B21',
          'popover-bg': '#182229',
          'hover-bg': '#202C33',
          'chat-bg': '#0B141A',
          'msg-in': '#202C33',
          'msg-out': '#005C4B',
          'quote-in': '#1D282F',
          'quote-out': '#025144',
          'input-bar': '#202C33',
          'input-field': '#2A3942',
          'text-primary': '#E9EDEF',
          'text-secondary': '#8696A0',
          'text-input': '#D1D7DB',
          'border-subtle': '#222D34',
          'check-blue': '#53BDEB',
        },
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          '"Segoe UI Emoji"',
          '"Apple Color Emoji"',
          '"Noto Color Emoji"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
