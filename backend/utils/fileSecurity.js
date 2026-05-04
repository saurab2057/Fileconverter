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
// Add this helper right before validateFileSecurity (or inside it)
const userFriendlyReason = (technicalReason) => {
    if (!technicalReason) return 'File blocked for security reasons.';
    
    if (technicalReason.startsWith('PDF contains dangerous element:'))
        return 'This PDF contains scripts or actions that aren’t allowed. Please remove them and try again.';
    if (technicalReason.includes('ZIP structure') || technicalReason.includes('Embedded valid'))
        return 'The file appears to contain hidden data and can’t be processed.';
    if (technicalReason.includes('Polyglot:') || technicalReason.includes('Embedded valid'))
        return 'The file appears to contain embedded data and can’t be processed.';
    if (technicalReason.includes('bytes of data found after EOF'))
        return 'The file contains unexpected extra data and was blocked for security.';
    if (technicalReason.startsWith('Suspicious entropy'))
        return 'File blocked for security reasons – the content seems suspicious. Try a different file.';
    
    // fallback: keep the message but strip filenames (already sanitized outside)
    return 'File blocked for security reasons. Please check the file and try again.';
};

export const validateFileSecurity = async (file, userId) => {
    const safeName = sanitizeFilename(file.originalname);

    try {
        const type = await fileTypeFromBuffer(file.buffer);

        if (!type) {
            console.warn(`[SECURITY BLOCK] Undetectable file type: "${safeName}" (user ${userId})`);
            return { message: `Cannot verify the file type. It may be corrupted or unsupported.` };
        }

        if (!ALLOWED_MIME_TYPES.has(type.mime)) {
            console.warn(`[SECURITY BLOCK] Invalid MIME ${type.mime} for "${safeName}" (user ${userId})`);
            return { message: `This file type is not supported. Please upload a media or PDF file.` };
        }

        const ext = file.originalname.split('.').pop()?.toLowerCase();

        if (!ext) {
            console.warn(`[SECURITY BLOCK] No extension: "${safeName}" (user ${userId})`);
            return { message: `File has no extension. Please upload a file with a valid extension.` };
        }

        const allowedExts = MIME_TO_EXTS[type.mime] || [];
        if (!allowedExts.includes(ext)) {
            console.warn(`[SECURITY BLOCK] Extension mismatch: "${safeName}" ext=.${ext} mime=${type.mime} (user ${userId})`);
            return { message: `The file extension doesn’t match its actual content. Please rename the file correctly.` };
        }

        const stegResult = runStegChecks(file, type.mime);

        if (!stegResult.clean) {
            console.warn(`[SECURITY BLOCK] Steg check failed: "${safeName}" — ${stegResult.reason} (user ${userId})`);
            return { message: userFriendlyReason(stegResult.reason) };
        }

        file.buffer = stegResult.strippedBuffer;
        return null;

    } catch (err) {
        console.error(`[VALIDATION ERROR] "${safeName}":`, err);
        return { message: `Security validation failed. Please try again.` };
    }
};