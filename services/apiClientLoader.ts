/**
 * apiClientLoader.ts — Carregador condicional do API client
 *
 * Em modo DEMO: carrega mockApiClient
 * Em modo PROD: carrega apiClient real
 */

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

let _apiInstance: any = null;
let _loading: Promise<any> | null = null;

async function loadApi() {
  if (_apiInstance) return _apiInstance;

  if (!_loading) {
    _loading = (async () => {
      if (IS_DEMO) {
        console.log('[apiClientLoader] Carregando mockApiClient...');
        const mod = await import('./mockApiClient');
        _apiInstance = mod.api;
        console.log('[apiClientLoader] mockApiClient carregado com sucesso');
      } else {
        const mod = await import('./apiClient');
        _apiInstance = mod.api;
      }
      return _apiInstance;
    })();
  }

  return _loading;
}

// Proxy que carrega o api de forma lazy na primeira chamada
export const api = new Proxy({} as any, {
  get(target, prop) {
    if (!_apiInstance) {
      // Retorna uma promise que resolve quando o api estiver pronto
      return async (...args: any[]) => {
        const apiInstance = await loadApi();
        return apiInstance[prop](...args);
      };
    }
    return _apiInstance[prop];
  }
});

// Inicializa imediatamente
loadApi();
