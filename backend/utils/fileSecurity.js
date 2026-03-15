import { fileTypeFromBuffer } from 'file-type';

// 🔒 CONVERSION SECURITY CONSTANTS
export const ALLOWED_MIME_TYPES = new Set([
    // Video
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm',
    'video/x-matroska', 'video/x-msvideo', 'video/mpeg', 'video/3gpp',
    // Audio
    'audio/mpeg', 'audio/mp4', 'audio/x-wav', 'audio/wav',
    'audio/flac', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/3gpp',
    // Image
    // Image (SVG blocked as input — can contain embedded JS. SVG is allowed as output only.)
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
// Returns null if valid, or an error object if invalid
export const validateFileSecurity = async (file, userId) => {
    try {
        // 1. DETECT ACTUAL MIME TYPE FROM CONTENT
        const type = await fileTypeFromBuffer(file.buffer);

        if (!type) {
            console.warn(`[SECURITY BLOCK] Undetectable file type: ${file.originalname} from user ${userId}`);
            return { message: `Could not verify file type for "${file.originalname}". Upload blocked for security.` };
        }

        // 2. BLOCK IF MIME TYPE NOT IN WHITELIST
        if (!ALLOWED_MIME_TYPES.has(type.mime)) {
            console.warn(`[SECURITY BLOCK] Invalid MIME ${type.mime} for ${file.originalname} from user ${userId}`);
            return { message: `File "${file.originalname}" contains invalid content. Only media/PDF files allowed.` };
        }

        // 3. BLOCK IF EXTENSION ≠ MIME TYPE
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

        return null; // Valid
    } catch (err) {
        console.error(`[VALIDATION ERROR] ${file.originalname}:`, err);
        return { message: `Security validation failed for "${file.originalname}"` };
    }
};