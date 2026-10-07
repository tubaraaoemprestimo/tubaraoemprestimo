// Executar: node scripts/check-dashboard-kpis.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../backend/node_modules/typescript');

const loans = Array.from({ length: 69 }, (_, i) => ({
    amount: 100, remainingAmount: 100, customerId: `c${i}`, status: 'ACTIVE',
    installments: [
        { status: 'PAID', amount: 30 }, // juros recebidos sem reduzir o principal
        { status: 'OPEN', amount: 30, dueDate: '2020-01-01' },
    ],
}));
const requests = [{ status: 'ACTIVE', amount: 100, customerId: 'c0' }];
const customers = Array.from({ length: 70 }, () => ({ joinedAt: new Date().toISOString() }));

async function load(failure = false) {
    let effect, kpis, errorState;
    const react = {
        createElement: () => null,
        useEffect: fn => { effect = fn; },
        useState: initial => [initial, value => {
            if (initial && typeof initial === 'object' && 'totalLent' in initial) kpis = value;
            if (initial === null && typeof value === 'string') errorState = value;
        }],
    };
    const api = { get: async endpoint => ({
        data: endpoint === '/loans' ? loans : endpoint === '/customers' ? customers : requests,
        error: failure ? { error: 'API indisponível' } : null,
    }) };
    const apiService = {
        getRequests: async () => requests, getCustomers: async () => customers,
        getGoalsSettings: async () => ({}),
        getAdminLoans: async () => ({ items: loans.slice(0, 50).map(({ installments, customerId, ...l }) => l) }),
    };
    const source = fs.readFileSync(path.join(__dirname, '../components/AdvancedKPIs.tsx'), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
    const exports = {};
    vm.runInNewContext(js, { exports, console: { error() {} }, require: name => {
        if (name === 'react') return { ...react, default: react };
        if (name.endsWith('/apiService')) return { apiService };
        if (name.endsWith('/apiClient')) return { api };
        if (name.endsWith('/types')) return { LoanStatus: { APPROVED: 'APPROVED', REJECTED: 'REJECTED', PENDING: 'PENDING' } };
        return {};
    }});
    exports.AdvancedKPIs();
    effect();
    await new Promise(resolve => setImmediate(resolve));
    return { kpis, errorState };
}
(async () => {
    const { kpis } = await load();
    assert.ok(kpis, 'KPI não atualizado: lista resumida sem installments provoca exceção');
    assert.equal(kpis.totalLent, 6900, 'somar todos os contratos, não apenas APPROVED');
    assert.equal(kpis.totalReceived, 2070, 'incluir juros efetivamente pagos');
    assert.equal(kpis.activeClients, 69, 'não truncar a lista em 50');
    assert.equal(kpis.registeredClients, 70);
    assert.equal(kpis.avgInstallments, 2);
    assert.equal(kpis.totalDefaulted, 2070);
    const failed = await load(true);
    assert.equal(failed.kpis, undefined, 'falha de API não pode virar zeros');
    assert.ok(failed.errorState, 'falha de API deve ficar visível');
    console.log('Dashboard: totais, juros, clientes, parcelas e erro de API OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
