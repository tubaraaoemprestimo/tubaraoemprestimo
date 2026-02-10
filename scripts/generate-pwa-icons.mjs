/**
 * Script para gerar ícones PWA a partir do Logo.png
 * Usa Canvas para redimensionar e adicionar fundo preto
 * Execute: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const LOGO_PATH = './Logo.png';
const SIZES = [192, 512];

async function generate() {
    const logo = await loadImage(readFileSync(LOGO_PATH));

    for (const size of SIZES) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Fundo preto
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);

        // Centralizar logo com padding
        const padding = size * 0.1;
        const availableSize = size - padding * 2;
        const scale = Math.min(availableSize / logo.width, availableSize / logo.height);
        const w = logo.width * scale;
        const h = logo.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;

        ctx.drawImage(logo, x, y, w, h);

        const buffer = canvas.toBuffer('image/png');
        writeFileSync(`./public/icon-${size}.png`, buffer);
        console.log(`✅ Gerado: public/icon-${size}.png (${size}x${size})`);
    }
}

generate().catch(console.error);
