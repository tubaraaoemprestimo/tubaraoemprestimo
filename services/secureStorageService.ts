/**
 * 🔐 Serviço de Criptografia Segura
 *
 * Usa Web Crypto API para criptografar dados sensíveis antes de armazenar no localStorage.
 * Chave derivada do userId + device fingerprint para segurança adicional.
 */

// Gera fingerprint único do dispositivo
async function getDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.colorDepth.toString(),
    screen.width.toString() + 'x' + screen.height.toString(),
  ];

  const fingerprint = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Deriva chave criptográfica do userId + device fingerprint
async function deriveKey(userId: string): Promise<CryptoKey> {
  const deviceFp = await getDeviceFingerprint();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + deviceFp),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('tubarao_biometric_v1'), // Salt fixo (pode ser melhorado com salt por usuário)
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export const secureStorageService = {
  /**
   * Criptografa e armazena dados sensíveis no localStorage
   */
  async setSecure(key: string, value: string, userId: string): Promise<void> {
    try {
      const cryptoKey = await deriveKey(userId);
      const encoder = new TextEncoder();
      const data = encoder.encode(value);

      // IV aleatório para cada criptografia
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      const encryptedData = {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
        version: 1, // Para futuras migrações
      };

      localStorage.setItem(key, JSON.stringify(encryptedData));
    } catch (error) {
      console.error('[SecureStorage] Encryption failed:', error);
      throw new Error('Falha ao armazenar dados de forma segura');
    }
  },

  /**
   * Recupera e descriptografa dados do localStorage
   */
  async getSecure(key: string, userId: string): Promise<string | null> {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const encryptedData = JSON.parse(stored);

      // Verificar versão (para futuras migrações)
      if (encryptedData.version !== 1) {
        console.warn('[SecureStorage] Unsupported version:', encryptedData.version);
        return null;
      }

      const cryptoKey = await deriveKey(userId);
      const iv = new Uint8Array(encryptedData.iv);
      const data = new Uint8Array(encryptedData.data);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('[SecureStorage] Decryption failed:', error);
      // Se falhar descriptografar, remover dado corrompido
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * Remove dado criptografado
   */
  remove(key: string): void {
    localStorage.removeItem(key);
  },

  /**
   * Verifica se Web Crypto API está disponível
   */
  isSupported(): boolean {
    return !!(window.crypto && window.crypto.subtle);
  },
};

export default secureStorageService;
