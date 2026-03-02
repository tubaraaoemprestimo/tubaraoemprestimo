// URL base do bucket Cloudflare R2 (público)
// IMPORTANTE: Habilitar acesso público no dashboard R2:
// https://dash.cloudflare.com → R2 → videos → Settings → Public Access → Allow Access
export const R2_BASE_URL = 'https://pub-8123cae3d0f14991b1fd5e456c4f9e24.r2.dev';

// URLs de cada vídeo do funil
export const VIDEOS = {
  preVenda:      `${R2_BASE_URL}/videos/01-pre-lancamento.mp4`,
  upsell:        `${R2_BASE_URL}/videos/02-upsell-modulos.mp4`,
  mentoriaOnline:`${R2_BASE_URL}/videos/03-pitch-mentorias.mp4`,
  presencial:    `${R2_BASE_URL}/videos/04-mentoria-presencial.mp4`,
  obrigado:      `${R2_BASE_URL}/videos/05-obrigado-final.mp4`,
} as const;
