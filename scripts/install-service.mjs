import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const run = promisify(execFile),
  root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quote = (value) =>
  '"' +
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%%") +
  '"';
const folder = join(homedir(), ".config/systemd/user");
await mkdir(folder, { recursive: true });
const file = join(folder, "imhotep.service");
await writeFile(
  file,
  `[Unit]
Description=Imhotep visual editor on the private Tailscale network
StartLimitIntervalSec=0

[Service]
Type=simple
WorkingDirectory=${root.replace(/%/g, "%%")}
ExecStart=${quote(process.execPath)} ${quote(join(root, "scripts/start-tailscale.mjs"))}
Environment=${quote("PATH=" + process.env.PATH)}
Environment=${quote("IMHOTEP_DATA_DIR=" + resolve(process.env.IMHOTEP_DATA_DIR || join(root, "data")))}
${["PORT", "IMHOTEP_BACKUP_DIR", "IMHOTEP_PUBLIC_ORIGIN"]
  .filter((key) => process.env[key])
  .map((key) => "Environment=" + quote(key + "=" + process.env[key]))
  .join("\n")}
Restart=on-failure
RestartSec=5
TimeoutStopSec=35
KillMode=mixed
UMask=0077

[Install]
WantedBy=default.target
`,
);
await run("systemd-analyze", ["--user", "verify", file]);
await run("systemctl", ["--user", "daemon-reload"]);
await run("systemctl", [
  "--user",
  "enable",
  ...(process.argv.includes("--enable-only") ? [] : ["--now"]),
  "imhotep.service",
]);
console.log(
  `Serviço instalado: ${file}\nEstado: systemctl --user status imhotep\nLogs: journalctl --user -u imhotep`,
);
