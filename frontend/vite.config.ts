import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000, // Replace with your preferred port number
        strictPort: true, // Optional: prevents Vite from trying the next available port if this one is taken
    }
})