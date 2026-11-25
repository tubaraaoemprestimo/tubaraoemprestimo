/**
 * Verifica a trava do cron de cobrança contra PostgreSQL REAL e DESCARTÁVEL:
 * dois processos simultâneos → só um executa. Não usa tabelas (só advisory lock).
 * Recusa rodar se DATABASE_URL não for o banco descartável tubarao_paytest.
 */
import { fork } from 'node:child_process';

const url = process.env.DATABASE_URL || '';
if (!/\/tubarao_paytest(\?|$)/.test(url)) { console.error('Recusado: use o banco descartável tubarao_paytest.'); process.exit(2); }

async function child() {
    const { withCollectionLock } = await import('../src/cron/collectionCron');
    const { prisma } = await import('../src/services/prisma');
    const r = await withCollectionLock(async () => { await new Promise(res => setTimeout(res, 3000)); return 'executou'; });
    process.send?.(r.ran ? 'RAN' : 'SKIPPED');
    await prisma.$disconnect();
    process.exit(0);
}

async function main() {
    const run = () => new Promise<string>((resolve, reject) => {
        const c = fork(__filename, ['child'], { execArgv: process.execArgv });
        c.on('message', m => resolve(String(m)));
        c.on('exit', code => code !== 0 && reject(new Error('filho saiu com ' + code)));
    });
    const out = await Promise.all([run(), run()]);
    const ran = out.filter(o => o === 'RAN').length;
    console.log(`${ran === 1 ? 'PASSOU' : 'FALHOU'}  dois processos simultâneos: ${out.join(' + ')}`);
    const again = await run();
    console.log(`${again === 'RAN' ? 'PASSOU' : 'FALHOU'}  trava liberada após a execução: ${again}`);
    process.exit(ran === 1 && again === 'RAN' ? 0 : 1);
}

(process.argv[2] === 'child' ? child() : main()).catch(e => { console.error('ERRO', e?.message); process.exit(1); });
