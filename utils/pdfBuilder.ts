type PdfPage = {
  lines: string[];
};

const toAscii = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^ -~]/g, ' ');

const escapePdfText = (input: string): string =>
  input
    .replace(/\/g, '\')
    .replace(/\(/g, '\(')
    .replace(/\)/g, '\)');

const wrapLine = (line: string, maxChars: number): string[] => {
  if (line.length <= maxChars) return [line];

  const words = line.split(/\s+/);
  const result: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) result.push(current);
      current = word;
    }
  }

  if (current) result.push(current);
  return result.length ? result : [''];
};

const paginate = (lines: string[], maxLinesPerPage: number): PdfPage[] => {
  const pages: PdfPage[] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push({ lines: lines.slice(i, i + maxLinesPerPage) });
  }
  return pages.length ? pages : [{ lines: [' '] }];
};

const toBytes = (value: string): Uint8Array => {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
};

export const createTextPdf = (title: string, sections: Array<{ title?: string; lines: string[] }>): Blob => {
  const normalized: string[] = [];
  normalized.push(toAscii(title.toUpperCase()));
  normalized.push('');

  for (const section of sections) {
    if (section.title) {
      normalized.push(toAscii(section.title));
    }
    for (const line of section.lines) {
      const sanitized = toAscii(line);
      const wrapped = wrapLine(sanitized, 92);
      normalized.push(...wrapped);
    }
    normalized.push('');
  }

  const pages = paginate(normalized, 48);

  const objectCount = 3 + pages.length * 2;
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';

  const kids: string[] = [];
  const pageObjectStart = 4;

  for (let i = 0; i < pages.length; i += 1) {
    const pageObject = pageObjectStart + i * 2;
    const contentObject = pageObject + 1;
    kids.push(`${pageObject} 0 R`);

    const textParts: string[] = [];
    textParts.push('BT');
    textParts.push('/F1 11 Tf');
    textParts.push('14 TL');
    textParts.push('50 790 Td');

    for (const line of pages[i].lines) {
      textParts.push(`(${escapePdfText(line)}) Tj`);
      textParts.push('T*');
    }

    textParts.push('ET');

    const streamData = textParts.join('
');

    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${streamData.length} >>
stream
${streamData}
endstream`;
  }

  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [ ${kids.join(' ')} ] >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let output = '%PDF-1.4
';
  const offsets: number[] = [0];

  for (let i = 1; i <= objectCount; i += 1) {
    offsets[i] = output.length;
    output += `${i} 0 obj
${objects[i]}
endobj
`;
  }

  const xrefStart = output.length;
  output += `xref
0 ${objectCount + 1}
`;
  output += '0000000000 65535 f 
';

  for (let i = 1; i <= objectCount; i += 1) {
    output += `${String(offsets[i]).padStart(10, '0')} 00000 n 
`;
  }

  output += `trailer
<< /Size ${objectCount + 1} /Root 1 0 R >>
startxref
${xrefStart}
%%EOF`;

  return new Blob([toBytes(output)], { type: 'application/pdf' });
};
