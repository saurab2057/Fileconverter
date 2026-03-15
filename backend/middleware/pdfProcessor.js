import { getDocumentProxy, extractText } from 'unpdf';

export async function extractPdfText(pdfBytes, maxPages = 5) {
    try {
        // Load proxy to the underlying PDF.js document
        const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));

        const totalPages = pdf.numPages;
        const pagesToProcess = Math.min(maxPages, totalPages);

        let fullText = '';

        // You can now use pdf.js-like API
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

    } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error(`Failed to process PDF: ${error.message || 'Unknown error'}`);
    }
}