import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const child = spawn(process.execPath, [viteBin, 'build', '--minify=false'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    GOMAXPROCS: process.env.GOMAXPROCS || '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
