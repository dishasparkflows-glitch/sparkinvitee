import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    hmr: {
      overlay: true,
    },
  },
  customLogger: {
    ...console,
    warn: (msg, options) => {
      if (msg.includes('ECONNABORTED') || msg.includes('ws proxy')) return;
      console.warn(msg, options);
    },
    error: (msg, options) => {
      if (msg.includes('ECONNABORTED') || msg.includes('ws proxy')) return;
      console.error(msg, options);
    },
    info: (msg, options) => {
      if (msg.includes('ECONNABORTED') || msg.includes('ws proxy')) return;
      console.info(msg, options);
    },
  },
})
