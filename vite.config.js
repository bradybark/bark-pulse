import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Runs the Vercel-style functions in /api during `vite dev`, so the app works
// end-to-end without the Vercel CLI. In production Vercel runs these natively.
function devApi() {
  const apiDir = resolve(import.meta.dirname, 'api')
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()

        const url = new URL(req.url, 'http://localhost')
        const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')

        let file
        try {
          const files = readdirSync(apiDir)
          const match = files.find((f) => f.replace(/\.js$/, '') === name)
          if (!match) return next()
          file = resolve(apiDir, match)
        } catch {
          return next()
        }

        try {
          const mod = await server.ssrLoadModule(pathToFileURL(file).href)
          const handler = mod.default
          req.query = Object.fromEntries(url.searchParams)
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
            return res
          }
          await handler(req, res)
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'dev-api error', detail: String(err) }))
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
})
