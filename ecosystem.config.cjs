const path = require("path");

const root = __dirname;
const logDir = path.join(root, "logs");

/** @type {{ apps: import('pm2').StartOptions[] }} */
module.exports = {
  apps: [
    {
      name: "expense-api",
      cwd: path.join(root, "server"),
      script: "src/index.js",
      interpreter: "node",
      watch: ["src"],
      ignore_watch: ["node_modules"],
      env: { NODE_ENV: "development" },
      error_file: path.join(logDir, "expense-api-error.log"),
      out_file: path.join(logDir, "expense-api-out.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "expense-client",
      cwd: path.join(root, "client"),
      script: "node_modules/vite/bin/vite.js",
      args: "dev",
      interpreter: "node",
      env: { NODE_ENV: "development" },
      error_file: path.join(logDir, "expense-client-error.log"),
      out_file: path.join(logDir, "expense-client-out.log"),
      merge_logs: true,
      time: true,
    },
  ],
};
