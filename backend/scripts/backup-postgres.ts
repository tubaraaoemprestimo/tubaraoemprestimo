#!/usr/bin/env tsx
/**
 * Backup PostgreSQL Tubarão — pg_dump seguro.
 *
 * Uso (a partir de backend/):
 *   npx tsx scripts/backup-postgres.ts
 *   npx tsx scripts/backup-postgres.ts --out backups/manual
 *   npx tsx scripts/backup-postgres.ts --database-url "postgresql://..."
 *
 * Só executa pg_dump. Não altera banco.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface Options {
  databaseUrl: string;
  outDir: string;
  schemaOnly: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    databaseUrl: process.env.DATABASE_URL || '',
    outDir: path.join(process.cwd(), 'backups'),
    schemaOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--database-url') opts.databaseUrl = argv[++i] || '';
    else if (arg.startsWith('--database-url=')) opts.databaseUrl = arg.slice('--database-url='.length);
    else if (arg === '--out') opts.outDir = argv[++i] || opts.outDir;
    else if (arg.startsWith('--out=')) opts.outDir = arg.slice('--out='.length);
    else if (arg === '--schema-only') opts.schemaOnly = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Backup PostgreSQL Tubarão

Uso:
  npx tsx scripts/backup-postgres.ts
  npx tsx scripts/backup-postgres.ts --out backups/manual
  npx tsx scripts/backup-postgres.ts --database-url "postgresql://..."
  npx tsx scripts/backup-postgres.ts --schema-only

Saída: .dump custom format (-Fc), pronta para pg_restore.
`);
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.databaseUrl) throw new Error('DATABASE_URL ausente. Defina env DATABASE_URL ou use --database-url.');

  fs.mkdirSync(opts.outDir, { recursive: true });
  const file = path.join(opts.outDir, `tubarao-${stamp()}${opts.schemaOnly ? '-schema' : ''}.dump`);
  const args = ['--format=custom', '--verbose', '--no-owner', '--no-acl', '--file', file, opts.databaseUrl];
  if (opts.schemaOnly) args.unshift('--schema-only');

  console.log(`[Backup] Iniciando pg_dump: ${file}`);
  const child = spawn('pg_dump', args, { stdio: 'inherit', shell: false });

  await new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump saiu com código ${code}`)));
  });

  const size = fs.statSync(file).size;
  if (size <= 0) throw new Error(`Backup vazio: ${file}`);
  console.log(`[Backup] OK: ${file} (${size.toLocaleString('pt-BR')} bytes)`);
  console.log(`[Backup] Restore exemplo: pg_restore --clean --if-exists --dbname "$DATABASE_URL" "${file}"`);
}

main().catch((err) => {
  console.error('[Backup] ERRO:', err.message);
  process.exitCode = 1;
});
