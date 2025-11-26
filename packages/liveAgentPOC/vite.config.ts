import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import mkcert from 'vite-plugin-mkcert'

const disableNitro = process.env.DISABLE_NITRO === '1'

// Force Nitro/Srvx to prefer HTTP/1 when running the dev server with HTTPS.
if (!disableNitro) {
  process.env.NITRO_FORCE_HTTP1 = 'true'
  process.env.NODE_NO_HTTP2 = '1'
  process.env.SRVX_FORCE_HTTP1 = 'true'
}

const devtoolsEventBusPort = Number(
  process.env.TANSTACK_EVENT_BUS_PORT ?? '42169',
)

const config = defineConfig({
  plugins: [
    mkcert(),
    // devtools({
    //   eventBusConfig: {
    //     port: devtoolsEventBusPort,
    //   },
    // }),

    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ].filter(Boolean),
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 3100),
    https: true,
  },
  preview: {
    https: true,
  },
})

export default config
