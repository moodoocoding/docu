import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        create: resolve(__dirname, 'create.html'),
        settings: resolve(__dirname, 'settings.html'),
        login: resolve(__dirname, 'login.html'),
        history: resolve(__dirname, 'history.html'),
        contacts: resolve(__dirname, 'contacts.html'),
        guide_setup: resolve(__dirname, 'guide_setup.html'),
        guide_edufine: resolve(__dirname, 'guide_edufine.html'),
        guide_hwp: resolve(__dirname, 'guide_hwp.html'),
        guide_report: resolve(__dirname, 'guide_report.html'),
        messenger: resolve(__dirname, 'messenger.html'),
      },
    },
  },
})
