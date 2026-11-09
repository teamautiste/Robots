// Compila el frontend para el servidor sin internet.
//
// El servidor no puede reconstruir la imagen de Docker (no llega a Docker Hub
// ni a npm), así que se compila aquí y la carpeta resultante se monta dentro
// del contenedor "frontend" ya existente (ver compose.offline.yaml).
//
// Uso (en una máquina con node_modules instalados):
//   npm run build:offline
// Resultado: frontend-next/offline-build/  -> copiarla al servidor.

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'offline-build');

// Mismas URLs que usa el Dockerfile: las rewrites de Next se fijan al compilar.
const env = {
  ...process.env,
  BACKEND_URL: process.env.BACKEND_URL ?? 'http://backend:5000',
  CAMERA_SERVICE_URL: process.env.CAMERA_SERVICE_URL ?? 'http://host.docker.internal:5001',
  NEXT_TELEMETRY_DISABLED: '1',
};

execSync('npm run build', { cwd: root, env, stdio: 'inherit' });

// Se vacía en lugar de borrarla: en Windows la carpeta puede estar abierta
// (Explorador, VS Code) y borrarla falla con EPERM.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) rmSync(join(out, entry), { recursive: true, force: true });
cpSync(join(root, '.next', 'standalone'), out, { recursive: true });
cpSync(join(root, '.next', 'static'), join(out, '.next', 'static'), { recursive: true });
if (existsSync(join(root, 'public'))) {
  cpSync(join(root, 'public'), join(out, 'public'), { recursive: true });
}

// La compilación guarda la ruta absoluta de esta máquina; dentro del
// contenedor la app vive en /app (igual que con el Dockerfile).
const variants = [root, root.replaceAll('\\', '/'), JSON.stringify(root).slice(1, -1)];
for (const file of ['server.js', join('.next', 'required-server-files.json')]) {
  const path = join(out, file);
  let text = readFileSync(path, 'utf8');
  for (const v of variants) text = text.replaceAll(v, '/app');
  writeFileSync(path, text);
}

// Un solo archivo para copiar al servidor: así no se pierden node_modules ni
// la carpeta .next (que empieza con punto). tar.exe viene con Windows 10+.
const zip = join(root, 'offline-build.zip');
rmSync(zip, { force: true });
// En Windows se usa el tar.exe del sistema (bsdtar, sabe crear .zip); el de
// Git Bash es GNU tar y no entiende rutas "C:\...".
const tar = process.platform === 'win32'
  ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
  : 'bsdtar';
execSync(`"${tar}" -a -c -f "${zip}" -C "${out}" .`, { stdio: 'inherit' });

console.log(`\nListo: ${zip}\nEn el servidor (carpeta Robots):\n` +
  '  Remove-Item -Recurse -Force frontend-next\\offline-build -ErrorAction SilentlyContinue\n' +
  '  mkdir frontend-next\\offline-build\n' +
  '  tar -xf offline-build.zip -C frontend-next\\offline-build\n' +
  '  docker compose -f compose.yaml -f compose.offline.yaml up -d --no-build\n');
