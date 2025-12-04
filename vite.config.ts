import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  base: "./", // <<--- ensure relative paths in generated index.html
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React and core libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Radix UI components
          if (id.includes('node_modules/@radix-ui')) {
            return 'radix-vendor';
          }
          // Data and state management
          if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/zod')) {
            return 'data-vendor';
          }
          // Chart library
          if (id.includes('node_modules/recharts')) {
            return 'chart-vendor';
          }
          // Animation library
          if (id.includes('node_modules/framer-motion')) {
            return 'animation-vendor';
          }
          // Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          // Other large vendor libraries
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        chunkSizeWarningLimit: 600,
    },
  },
  },
 
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
