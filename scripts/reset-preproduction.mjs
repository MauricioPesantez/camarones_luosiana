import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function loadLocalEnv() {
  const envPath = join(projectRoot, '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL no esta configurada.');
  process.exit(1);
}

let target;
try {
  target = new URL(databaseUrl);
} catch {
  console.error('DATABASE_URL no es una URL valida.');
  process.exit(1);
}

if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
  console.error('El reset solo admite PostgreSQL.');
  process.exit(1);
}

const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
if (!target.hostname || !databaseName) {
  console.error('DATABASE_URL no identifica host y base de datos.');
  process.exit(1);
}

const targetLabel = `${target.hostname}/${databaseName}`;
const expectedConfirmation = `BORRAR:${targetLabel}`;

if (process.argv.includes('--show-target')) {
  console.log(`Destino: ${targetLabel}`);
  console.log(`Confirmacion requerida: ${expectedConfirmation}`);
  process.exit(0);
}

if (process.env.RESET_PREPROD_CONFIRM !== expectedConfirmation) {
  console.error('RESET BLOQUEADO: esta operacion elimina todos los datos.');
  console.error(`Destino detectado: ${targetLabel}`);
  console.error('Primero ejecuta: npm run db:reset:preprod -- --show-target');
  console.error('Luego define RESET_PREPROD_CONFIRM con el valor exacto mostrado.');
  process.exit(1);
}

const executable = (name) =>
  join(
    projectRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${name}.cmd` : name,
  );

console.log(`Reiniciando exclusivamente: ${targetLabel}`);
run(executable('prisma'), [
  'migrate',
  'reset',
  '--force',
  '--skip-seed',
  '--skip-generate',
  '--schema',
  'prisma/schema.prisma',
]);

run(executable('ts-node'), [
  '--compiler-options',
  '{"module":"CommonJS","moduleResolution":"node"}',
  'prisma/seed.ts',
]);
run(executable('prisma'), ['generate']);

console.log(`Reset y seed completados en ${targetLabel}.`);
