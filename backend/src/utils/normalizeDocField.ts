/**
 * Normaliza valores de campos de documentos que podem vir em diferentes formatos
 * @param value Valor do campo que pode ser string, array ou undefined
 * @returns Primeiro item do array ou a string original ou null
 */
export function normalizeDocField(value: any): string | null {
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return null;
}