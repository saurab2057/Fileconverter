// workers/pdfWorker.js
import { parentPort } from 'node:worker_threads';
import { extractPdfText } from '../utils/pdfProcessor.js';

parentPort.on('message', async ({ buffer, maxPages }) => {
  try {
    const result = await extractPdfText(buffer, maxPages);
    parentPort.postMessage({ success: true, result });
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
});