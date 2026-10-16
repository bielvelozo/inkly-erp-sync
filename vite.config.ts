import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

// `shopify app dev` passes the app credentials as environment variables of this process;
// the Worker only sees its own bindings, so in dev they are forwarded as vars (never in a build).
const SHOPIFY_DEV_VARS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "SCOPES",
  "SHOP_CUSTOM_DOMAIN",
  "ERP_API_URL",
  "ERP_API_KEY",
  "ERP_WEBHOOK_SECRET",
];

function devVars() {
  return Object.fromEntries(
    SHOPIFY_DEV_VARS.flatMap((name) =>
      process.env[name] ? [[name, process.env[name]!]] : [],
    ),
  );
}

export default defineConfig(({ command }) => ({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "workers", "node_modules"],
    },
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      ...(command === "serve" ? { config: { vars: devVars() } } : {}),
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: [
      {
        // @prisma/client re-exports ".prisma/client/default", which bundlers read as a relative path;
        // on workerd the right build is the Wasm one (it needs the D1 driver adapter).
        find: /^\.prisma\/client\/default$/,
        replacement: fileURLToPath(
          new URL("./node_modules/.prisma/client/wasm.js", import.meta.url),
        ),
      },
    ],
  },
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
  environments: {
    ssr: {
      optimizeDeps: {
        include: [
          "react",
          "react/jsx-runtime",
          "react-dom/server",
          "react-router",
          "isbot",
          "@shopify/app-bridge-react",
          "@shopify/shopify-app-react-router/react",
          "@shopify/shopify-app-react-router/server",
          "@shopify/shopify-app-session-storage-prisma",
          "@prisma/adapter-d1",
          "@prisma/client",
        ],
      },
    },
  },
}) satisfies UserConfig);
