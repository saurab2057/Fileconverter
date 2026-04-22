import { fileTypeFromBuffer } from 'file-type';
import { runStegChecks } from './stegSecurity.js';

// 🔒 CONVERSION SECURITY CONSTANTS
export const ALLOWED_MIME_TYPES = new Set([
    // Video
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm',
    'video/x-matroska', 'video/x-msvideo', 'video/mpeg', 'video/3gpp',
    // Audio
    'audio/mpeg', 'audio/mp4', 'audio/x-wav', 'audio/wav',
    'audio/flac', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/3gpp',
    // Image
    // (SVG blocked as input — can contain embedded JS. SVG is allowed as output only.)
    'image/png', 'image/jpeg', 'image/gif',
    'image/webp', 'image/bmp', 'image/tiff', 'image/x-icon',
    // Document
    'application/pdf'
]);

export const MIME_TO_EXTS = {
    'video/mp4': ['mp4', 'm4v'],
    'video/quicktime': ['mov'],
    'video/webm': ['webm'],
    'video/x-matroska': ['mkv'],
    'video/x-msvideo': ['avi'],
    'video/mpeg': ['mpg', 'mpeg'],
    'audio/mpeg': ['mp3'],
    'audio/mp4': ['m4a', 'mp4'],
    'audio/x-wav': ['wav'],
    'audio/wav': ['wav'],
    'audio/flac': ['flac'],
    'audio/aac': ['aac'],
    'audio/ogg': ['ogg'],
    'image/png': ['png'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'image/bmp': ['bmp'],
    'image/tiff': ['tiff', 'tif'],
    'application/pdf': ['pdf']
};

// 🔒 HELPER: SANITIZE FILENAME
export const sanitizeFilename = (filename) => {
    return filename
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s.-]/g, '')
        .replace(/[\s-]+/g, ' ')
        .trim();
};

// 🔒 HELPER: VALIDATE FILE SECURITY (ASYNC)
//
// Validation pipeline (runs in order):
//   1. Detect true MIME type from buffer magic bytes
//   2. Block if MIME not in whitelist
//   3. Block if file extension does not match detected MIME
//   4. Run steganography / hidden payload checks:
//        a. PDF embedded JS / dangerous action scan
//        b. Data-after-EOF detection (payload appended after end marker)
//        c. Polyglot file detection (dual-format file signatures)
//        d. JPEG/PNG metadata stripping (mutates file.buffer with clean version)
//        e. Shannon entropy analysis
//
// Returns null if the file is safe.
// Returns { message: string } if the file should be blocked.
//
// IMPORTANT: On success, file.buffer is replaced with the metadata-stripped
// version for JPEG and PNG files. Controllers require no changes —
// they always read file.buffer which will already be the clean version.
export const validateFileSecurity = async (file, userId) => {
    try {
        // ── STEP 1: Detect actual MIME type from file content ──
        const type = await fileTypeFromBuffer(file.buffer);

        if (!type) {
            console.warn(`[SECURITY BLOCK] Undetectable file type: ${file.originalname} from user ${userId}`);
            return { message: `Could not verify file type for "${file.originalname}". Upload blocked for security.` };
        }

        // ── STEP 2: Block if MIME is not in the whitelist ─────
        if (!ALLOWED_MIME_TYPES.has(type.mime)) {
            console.warn(`[SECURITY BLOCK] Invalid MIME ${type.mime} for ${file.originalname} from user ${userId}`);
            return { message: `File "${file.originalname}" contains invalid content. Only media/PDF files allowed.` };
        }

        // ── STEP 3: Block if extension does not match MIME ────
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        if (!ext) {
            console.warn(`[SECURITY BLOCK] No extension: ${file.originalname} from user ${userId}`);
            return { message: `File "${file.originalname}" has no extension. Please ensure valid file extensions.` };
        }

        const allowedExts = MIME_TO_EXTS[type.mime] || [];
        if (!allowedExts.includes(ext)) {
            console.warn(`[SECURITY BLOCK] Extension mismatch: ${file.originalname} (${type.mime}) from user ${userId}`);
            return { message: `File extension does not match content type for "${file.originalname}".` };
        }

        // ── STEP 4: Steganography & hidden payload checks ─────
        //
        // runStegChecks returns:
        //   { clean: true,  strippedBuffer } — safe
        //   { clean: false, reason }         — block the file
        //
        // For JPEG and PNG, strippedBuffer is the EXIF/metadata-free
        // version. Replacing file.buffer here means CloudConvert always
        // receives clean data — no controller changes required.
        const stegResult = runStegChecks(file, type.mime);

        if (!stegResult.clean) {
            console.warn(`[SECURITY BLOCK] Steg check failed: ${file.originalname} (user ${userId}): ${stegResult.reason}`);
            return { message: `File "${file.originalname}" was blocked: ${stegResult.reason}` };
        }

        // Replace buffer with cleaned version (EXIF stripped for images).
        // For non-image types strippedBuffer === original buffer — no cost.
        file.buffer = stegResult.strippedBuffer;

        return null; // ✅ File is valid and clean

    } catch (err) {
        console.error(`[VALIDATION ERROR] ${file.originalname}:`, err);
        return { message: `Security validation failed for "${file.originalname}"` };
    }
};