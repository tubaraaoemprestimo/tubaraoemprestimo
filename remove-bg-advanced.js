import sharp from 'sharp';

async function removeBgAdvanced() {
  try {
    const input = await sharp('C:/Users/jefferson/Downloads/logo.png')
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = input;
    const { width, height, channels } = info;
    const newData = Buffer.from(data);

    // Remove pixels escuros (fundo preto/cinza escuro)
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Se for escuro (RGB < 50), torna transparente
      if (r < 50 && g < 50 && b < 50) {
        newData[i + 3] = 0; // Alpha = 0 (transparente)
      }
    }

    await sharp(newData, { raw: { width, height, channels: 4 } })
      .png()
      .toFile('public/logo-transparent.png');

    console.log('✅ Logo processado com sucesso!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

removeBgAdvanced();
