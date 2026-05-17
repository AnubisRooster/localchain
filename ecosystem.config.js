// ─────────────────────────────────────────────────────────────
// PM2 Ecosystem – LocalChain
// Start everything: pm2 start ecosystem.config.js
// ─────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    // ── Blockchain node ─────────────────────────────────────
    {
      name: "localchaind",
      script: process.env.HOME + "/go/bin/localchaind",
      args: "start --home " + process.env.HOME + "/.localchaind --minimum-gas-prices 0stake",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      env: {
        HOME: process.env.HOME,
      },
    },

    // ── Dashboard backend API ───────────────────────────────
    {
      name: "localchain-api",
      script: "dashboard/backend/server.js",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: ["dashboard/backend"],
      watch_delay: 1000,
      env: {
        NODE_ENV: "production",
        API_PORT: 4000,
        COSMOS_REST: "http://localhost:1317",
        TENDERMINT_RPC: "http://localhost:26657",
      },
    },

    // ── Dashboard frontend ──────────────────────────────────
    {
      name: "localchain-dashboard",
      script: "npm",
      args: "start",
      cwd: "./dashboard/frontend",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
      },
    },

    // ── Watchdog ────────────────────────────────────────────
    {
      name: "localchain-watchdog",
      script: "watchdog/watchdog.js",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 10000,
      watch: false,
    },
  ],
};
