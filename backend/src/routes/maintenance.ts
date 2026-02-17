import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import fs from 'fs';
import path from 'path';

export const maintenanceRouter = Router();

// Endpoint de emergência para rodar migração SQL
maintenanceRouter.get('/run-migration', async (req: Request, res: Response) => {
    try {
        // Tenta achar o arquivo usando process.cwd() (raiz do projeto backend)
        const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', '20260216_complete_partner_system.sql');

        console.log('Procurando arquivo de migração em:', sqlPath);

        if (!fs.existsSync(sqlPath)) {
            res.status(404).json({ error: 'Migration file not found' });
            return;
        }

        const sql = fs.readFileSync(sqlPath, 'utf-8');

        // Separar comandos por ";\n" ou ";\r\n" para tentar executar um a um
        // Isso é frágil para blocos PL/pgSQL complexos, mas o arquivo usa DO $$ ... END $$;
        // Vamos tentar executar o bloco inteiro primeiro.
        // Se falhar, tentamos split simples.

        try {
            await prisma.$executeRawUnsafe(sql);
            res.json({ success: true, mode: 'full_execution', message: 'Migration executed successfully' });
        } catch (e) {
            console.log('Full execution failed, trying statement by statement...');

            // Split simples por ";\n" (assumindo formatação do arquivo)
            const statements = sql.split(/;\s*[\r\n]+/).filter(s => s.trim().length > 0);

            const results = [];
            for (const stmt of statements) {
                try {
                    await prisma.$executeRawUnsafe(stmt);
                    results.push({ success: true, stmt: stmt.substring(0, 50) + '...' });
                } catch (err: any) {
                    results.push({ success: false, stmt: stmt.substring(0, 50) + '...', error: err.message });
                }
            }

            res.json({ success: true, mode: 'split_execution', results });
        }

    } catch (error: any) {
        console.error('Migration failed:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});
