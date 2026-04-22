// middleware/pdfProcessor.js
import { getDocumentProxy } from 'unpdf';

const PDF_PROCESS_TIMEOUT_MS = 8000; // 8s hard limit

/**
 * Extract text from a PDF buffer with a timeout.
 * @param {Uint8Array|Buffer} pdfBytes - Raw PDF data
 * @param {number} maxPages - Maximum pages to process
 * @returns {Promise<{text: string, totalPages: number, pagesProcessed: number}>}
 */
export async function extractPdfText(pdfBytes, maxPages = 5) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('PDF processing timed out (possible malformed structure)'));
    }, PDF_PROCESS_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      _extractInternal(pdfBytes, maxPages),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function _extractInternal(pdfBytes, maxPages) {
  // Convert Buffer to Uint8Array if needed (unpdf accepts both)
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  
  const pdf = await getDocumentProxy(data);
  const totalPages = pdf.numPages;
  const pagesToProcess = Math.min(maxPages, totalPages);
  let fullText = '';

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => item.str?.trim() || '')
      .filter(str => str.length > 0)
      .join(' ');

    if (pageText.trim().length > 0) {
      fullText += `\n\n[Page ${i}]\n${pageText.trim()}`;
    }
  }

  return {
    text: fullText.trim(),
    totalPages,
    pagesProcessed: pagesToProcess
  };
}