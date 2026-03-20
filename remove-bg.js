import sharp from 'sharp';

async function removeBg() {
  try {
    await sharp('public/logo.jpg')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        const { width, height, channels } = info;
        const newData = Buffer.from(data);

        // Remove pixels brancos e cinza claro (RGB > 200)
        for (let i = 0; i < data.length; i += channels) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Se for branco, cinza claro ou bege claro, torna transparente
          if (r > 200 && g > 200 && b > 200) {
            newData[i + 3] = 0; // Alpha = 0 (transparente)
          }
        }

        return sharp(newData, { raw: { width, height, channels } })
          .png()
          .toFile('public/logo-transparent.png');
      });

    console.log('✅ Logo com fundo removido: public/logo-transparent.png');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

removeBg();
