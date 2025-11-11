import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 배포용 - base를 직접 설정
export default defineConfig({
  plugins: [react()],
  base: '/GcodeViewer/',
})