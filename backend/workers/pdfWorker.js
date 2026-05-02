// workers/pdfWorker.js
import { parentPort } from 'node:worker_threads';
import { extractPdfText } from '../utils/pdfProcessor.js';


// ─────────────────────────────────────────────────────────────
// PARENT PORT ERROR HANDLER
//
// Fires if the message channel itself breaks (parent process crash,
// thread pool reclaim, IPC pipe failure). Without this, the error
// is unhandled and the worker exits with an uncaught exception —
// which surfaces as a silent failure in the parent's worker pool.
// The worker exits either way, but this ensures the error is logged.
// ─────────────────────────────────────────────────────────────
parentPort.on('error', (err) => {
    console.error('[PDFWorker] parentPort channel error:', err.message);
});


// ─────────────────────────────────────────────────────────────
// MESSAGE HANDLER
//
// Expects: { buffer: Buffer|Uint8Array, maxPages: number }
// Posts back: { success: true, result } | { success: false, error }
//
// Malformed message guard: if the parent sends an unexpected shape,
// the destructuring throws — caught here and returned as a typed
// failure so the parent's Promise rejects cleanly rather than hanging.
// ─────────────────────────────────────────────────────────────
parentPort.on('message', async (message) => {
    try {
        const { buffer, maxPages } = message;

        if (!buffer || typeof maxPages !== 'number') {
            throw new Error(`Malformed worker message: expected { buffer, maxPages }, got ${JSON.stringify(Object.keys(message))}`);
        }

        const result = await extractPdfText(buffer, maxPages);
        parentPort.postMessage({ success: true, result });

    } catch (err) {
        parentPort.postMessage({ success: false, error: err.message });
    }
});