// utils/fileSecurity.js
import { fileTypeFromBuffer } from 'file-type';
import { runStegChecks } from './stegSecurity.js';


// ─────────────────────────────────────────────────────────────
// ALLOWED MIME TYPES
// SVG is intentionally excluded as input — it can contain embedded
// JavaScript. SVG is allowed as a conversion output only.
// ─────────────────────────────────────────────────────────────
export const ALLOWED_MIME_TYPES = new Set([
    // Video
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm',
    'video/x-matroska', 'video/x-msvideo', 'video/mpeg', 'video/3gpp',
    // Audio
    'audio/mpeg', 'audio/mp4', 'audio/x-wav', 'audio/wav',
    'audio/flac', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/3gpp',
    // Image
    'image/png', 'image/jpeg', 'image/gif',
    'image/webp', 'image/bmp', 'image/tiff', 'image/x-icon',
    // Document
    'application/pdf'
]);

export const MIME_TO_EXTS = {
    'video/mp4':        ['mp4', 'm4v'],
    'video/quicktime':  ['mov'],
    'video/webm':       ['webm'],
    'video/x-matroska': ['mkv'],
    'video/x-msvideo':  ['avi'],
    'video/mpeg':       ['mpg', 'mpeg'],
    'audio/mpeg':       ['mp3'],
    'audio/mp4':        ['m4a', 'mp4'],
    'audio/x-wav':      ['wav'],
    'audio/wav':        ['wav'],
    'audio/flac':       ['flac'],
    'audio/aac':        ['aac'],
    'audio/ogg':        ['ogg'],
    'image/png':        ['png'],
    'image/jpeg':       ['jpg', 'jpeg'],
    'image/gif':        ['gif'],
    'image/webp':       ['webp'],
    'image/bmp':        ['bmp'],
    'image/tiff':       ['tiff', 'tif'],
    'application/pdf':  ['pdf']
};


// ─────────────────────────────────────────────────────────────
// SANITIZE FILENAME
//
// Strips diacritics, non-word characters, and normalises whitespace
// so the result is safe to include in HTTP responses and log lines.
//
// Falls back to 'unnamed_file' if the entire name is stripped
// (e.g. a filename composed entirely of CJK or special characters).
// This prevents an empty string reaching error message templates.
//
// Called inside validateFileSecurity before any user-supplied
// filename is embedded in a response or log line.
// ─────────────────────────────────────────────────────────────
export const sanitizeFilename = (filename) => {
    if (!filename) return 'unnamed_file';

    const sanitized = filename
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/[^\w\s.-]/g, '')        // keep word chars, spaces, dots, hyphens
        .replace(/[\s-]+/g, ' ')          // collapse runs of spaces/hyphens
        .trim();

    return sanitized || 'unnamed_file';
};


// ─────────────────────────────────────────────────────────────
// VALIDATE FILE SECURITY
//
// Validation pipeline (runs in order):
//   1. Detect true MIME type from buffer magic bytes
//   2. Block if MIME not in whitelist
//   3. Block if file extension does not match detected MIME
//   4. Steganography / hidden payload checks (stegSecurity.js):
//        a. PDF embedded JS / dangerous action scan
//        b. Data-after-EOF detection
//        c. Polyglot file detection
//        d. JPEG/PNG metadata stripping → replaces file.buffer
//        e. Shannon entropy analysis
//
// Returns: null          → file is safe, file.buffer is clean
//          { message }   → file is blocked, return message to client
//
// On success, file.buffer is replaced with the metadata-stripped
// version for JPEG/PNG. Controllers always read file.buffer and
// receive clean data — no changes required in controllers.
// ─────────────────────────────────────────────────────────────
export const validateFileSecurity = async (file, userId) => {
    // Sanitize filename once here — used in all error messages and
    // log lines below so user-controlled characters cannot inject
    // content into responses or structured logs.
    const safeName = sanitizeFilename(file.originalname);

    try {
        // ── STEP 1: Detect actual MIME type from magic bytes ──────
        const type = await fileTypeFromBuffer(file.buffer);

        if (!type) {
            console.warn(`[SECURITY BLOCK] Undetectable file type: "${safeName}" (user ${userId})`);
            return { message: `Could not verify file type for "${safeName}". Upload blocked for security.` };
        }

        // ── STEP 2: Block if MIME is not whitelisted ──────────────
        if (!ALLOWED_MIME_TYPES.has(type.mime)) {
            console.warn(`[SECURITY BLOCK] Invalid MIME ${type.mime} for "${safeName}" (user ${userId})`);
            return { message: `File "${safeName}" contains invalid content. Only media and PDF files are allowed.` };
        }

        // ── STEP 3: Block if extension does not match MIME ────────
        const ext = file.originalname.split('.').pop()?.toLowerCase();

        if (!ext) {
            console.warn(`[SECURITY BLOCK] No extension: "${safeName}" (user ${userId})`);
            return { message: `File "${safeName}" has no extension. Please upload a file with a valid extension.` };
        }

        const allowedExts = MIME_TO_EXTS[type.mime] || [];
        if (!allowedExts.includes(ext)) {
            console.warn(`[SECURITY BLOCK] Extension mismatch: "${safeName}" ext=.${ext} mime=${type.mime} (user ${userId})`);
            return { message: `File extension does not match content type for "${safeName}".` };
        }

        // ── STEP 4: Steganography & hidden payload checks ─────────
        const stegResult = runStegChecks(file, type.mime);

        if (!stegResult.clean) {
            console.warn(`[SECURITY BLOCK] Steg check failed: "${safeName}" — ${stegResult.reason} (user ${userId})`);
            return { message: `File "${safeName}" was blocked: ${stegResult.reason}` };
        }

        // Replace buffer with cleaned version (EXIF/metadata stripped
        // for JPEG and PNG). For all other types strippedBuffer === the
        // original buffer — no extra memory cost.
        file.buffer = stegResult.strippedBuffer;

        return null; // ✅ File is valid and clean

    } catch (err) {
        console.error(`[VALIDATION ERROR] "${safeName}":`, err);
        return { message: `Security validation failed for "${safeName}".` };
    }
};