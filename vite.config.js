import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    target: 'es2015',
    cssTarget: 'chrome50',
    modulePreload: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  plugins: [
    {
      name: 'mini-tool-classic-script',
      enforce: 'post',
      transformIndexHtml(html) {
        let scriptTag = ''
        let out = html
          .replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g, (_, src) => {
            scriptTag = `<script defer src="${src}"></script>`
            return ''
          })
          .replace(/<script\s+crossorigin\s+type="module"\s+src="([^"]+)"><\/script>/g, (_, src) => {
            scriptTag = `<script defer src="${src}"></script>`
            return ''
          })
          .replace(/<link\s+rel="modulepreload"[^>]*>/g, '')
          .replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g, '<link rel="stylesheet" href="$1">')
        if (scriptTag) {
          out = out.replace('</body>', `  ${scriptTag}\n</body>`)
        }
        return out
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
})
