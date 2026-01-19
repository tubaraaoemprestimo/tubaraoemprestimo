
import { createWorker } from 'tesseract.js';

export interface OCRResult {
  name?: string;
  cpf?: string;
  birthDate?: string;
  rawText: string;
  success: boolean;
}

export const ocrService = {
  /**
   * Processes an image to extract Brazilian document data (CNH/RG)
   * Runs locally in the browser using WebAssembly
   */
  scanDocument: async (imageSrc: string): Promise<OCRResult> => {
    try {
      console.log('Starting OCR...');
      const worker = await createWorker('por'); // Load Portuguese language data
      
      const { data: { text } } = await worker.recognize(imageSrc);
      console.log('OCR Raw Text:', text);
      
      await worker.terminate();

      return parseDocumentText(text);
    } catch (error) {
      console.error('OCR Error:', error);
      return { rawText: '', success: false };
    }
  }
};

/**
 * Parses raw OCR text to find CPF, Date and Name using Heuristics and Regex
 */
function parseDocumentText(text: string): OCRResult {
  const result: OCRResult = {
    rawText: text,
    success: true
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Extract CPF
  // Regex for 000.000.000-00 or 00000000000
  const cpfRegex = /(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[-\s]?\d{2})/;
  const cpfMatch = text.match(cpfRegex);
  if (cpfMatch) {
    result.cpf = cpfMatch[0].replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  // 2. Extract Date (Birth Date)
  // Look for date patterns. In CNH, Birth Date is usually near "NASCIMENTO"
  const dateRegex = /(\d{2}\/\d{2}\/\d{4})/;
  const dates = text.match(new RegExp(dateRegex, 'g'));
  
  if (dates && dates.length > 0) {
    // Heuristic: If multiple dates, birth date is usually the earliest meaningful date (e.g. not issue date)
    // Or scan for lines containing "NASC"
    const birthLine = lines.find(l => l.toUpperCase().includes('NASC'));
    if (birthLine) {
        const match = birthLine.match(dateRegex);
        if (match) result.birthDate = match[0];
    }
    
    // Fallback: Use the first date found if no explicit label, but CNH has issue date too. 
    // Usually Issue Date > Birth Date. 
    if (!result.birthDate) {
        // Simple heuristic: pick a date that is likely a birth date (e.g., > 18 years ago)
        // For simplicity, taking the first valid date found that isn't today
        result.birthDate = dates[0]; 
    }
  }

  // 3. Extract Name
  // Hardest part. CNH Strategy:
  // Usually the name is the line strictly alphabetic, uppercase, often after "NOME"
  
  // Clean up common OCR artifacts
  const cleanLines = lines.filter(l => 
    l.length > 4 && 
    !l.includes('REPÚBLICA') && 
    !l.includes('FEDERATIVA') && 
    !l.includes('HABILITAÇÃO') &&
    !l.includes('VALIDADE') &&
    !l.includes('DATA') &&
    !l.includes('ASSINATURA')
  );

  // Look for a line that is mostly uppercase letters
  const nameRegex = /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]+$/;
  
  for (const line of cleanLines) {
      if (nameRegex.test(line) && line.split(' ').length >= 2) {
          // Additional check: exclude known headers even if uppercase
          if (line.includes('NOME') || line.includes('PAI') || line.includes('MAE')) continue;
          
          result.name = line;
          break; // Assume first valid name-like line is the name
      }
  }

  return result;
}
