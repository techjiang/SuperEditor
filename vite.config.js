import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('mermaid')) return 'mermaid';
            if (id.includes('pdfjs-dist')) return 'pdf';
            if (id.includes('pptxgenjs') || id.includes('jszip')) return 'office-write';
            if (id.includes('/docx/') || id.includes('mammoth') || id.includes('turndown')) return 'office-read';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf-export';
            if (id.includes('katex')) return 'katex';
            if (id.includes('highlight.js')) return 'highlight';
            if (id.includes('@codemirror/lang-') && !id.includes('@codemirror/lang-markdown')) return;
            if (id.includes('@lezer/') && !/@lezer\/(highlight|common|markdown)/.test(id)) return;
            if (id.includes('@codemirror') || id.includes('/codemirror/') || id.includes('@lezer')) return 'editor';
          }
        },
      },
    },
  },
});
