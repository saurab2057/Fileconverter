// utils/stegSecurity.js
//
// 🔒 STEGANOGRAPHY & HIDDEN PAYLOAD PROTECTION
//
// What this file defends against:
//   1. PDF Embedded JS     — /JS, /JavaScript, /OpenAction, /Launch in PDFs
//   2. Polyglot Files      — files that are valid in two formats simultaneously
//                            (e.g. image.jpg that is also a ZIP archive)
//   3. Data After EOF      — malicious payload appended after the file's
//                            legitimate end marker (JPEG FFD9, PNG IEND, PDF %%EOF)
//   4. JPEG EXIF Stripping — removes all APP1/APP2-15 metadata segments
//                            (attacker-controlled fields like Artist, Comment, GPS)
//   5. PNG Metadata Strip  — removes tEXt, iTXt, zTXt, eXIf, tIME chunks
//   6. Entropy Check       — high Shannon entropy in non-compressed files
//                            indicates encrypted/hidden payload
//
// Design decisions:
//   - No external dependencies — pure Node.js Buffer manipulation
//   - Fail SAFE on parser errors (returns original buffer, not crash)
//   - JPEG/PNG buffers are replaced with cleaned versions transparently.
//     file.buffer is mutated in validateFileSecurity so controllers
//     never need to change — they always upload clean data to CloudConvert.
//   - Entropy check is SKIPPED for already-compressed formats (JPEG, MP4,
//     MP3 etc.) because compressed data naturally has high entropy —
//     flagging it would cause constant false positives.
//
//   POLYGLOT DETECTION OVERHAUL (v2):
//   - Only scans image/jpeg, image/png, application/pdf.
//   - Requires full structural validity, not just magic bytes.
//   - ZIP: EOCD + central directory + at least one local file header, ≤1000 entries.
//   - PDF: header, xref, trailer, startxref, object graph, /Root reference.
//   - PNG: chunk walk (IHDR → IEND), no CRC (sufficient for detection).
//   - Gzip/RAR/PE/ELF/7‑Zip/HTML signatures removed — were causing false positives.
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────
// 1. CONSTANTS & SIGNATURES
// ─────────────────────────────────────────────────────────
const ZIP_LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

const SKIP_ENTROPY_MIMES = new Set([
    'image/jpeg', 'image/webp', 'image/gif',
    'image/png',
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm',
    'video/x-matroska', 'video/x-msvideo', 'video/mpeg', 'video/3gpp',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm',
    'audio/3gpp',
]);

const ENTROPY_THRESHOLD = 7.8;
const ENTROPY_SAMPLE_BYTES = 64 * 1024;

const POLYGLOT_TARGET_MIMES = new Set([
    'image/jpeg',
    'image/png',
    'application/pdf'
]);

const POLYGLOT_MIN_OFFSET = 512;     // skip small header
const POLYGLOT_NEAR_EOF = 4096;      // focus on tail injection

// ─────────────────────────────────────────────────────────
// 2. EOF LOCATORS
// ─────────────────────────────────────────────────────────
const findJpegEOF = (buffer) => {
    for (let i = buffer.length - 2; i >= 2; i--) {
        if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) return i + 2;
    }
    return buffer.length;
};

const findPngEOF = (buffer) => {
    const IEND = Buffer.from([0x49, 0x45, 0x4E, 0x44]);
    const idx = buffer.lastIndexOf(IEND);
    if (idx !== -1) return idx + 4 + 4;
    return buffer.length;
};

const findPdfEOF = (buffer) => {
    const EOF_MARKER = Buffer.from('%%EOF');
    const idx = buffer.lastIndexOf(EOF_MARKER);
    if (idx !== -1) return idx + EOF_MARKER.length + 2;
    return buffer.length;
};


// ─────────────────────────────────────────────────────────
// 3. DATA-AFTER-EOF DETECTOR
// ─────────────────────────────────────────────────────────
const checkDataAfterEOF = (buffer, detectedMime) => {
    let eofOffset = null;
    let formatLabel = '';

    if (detectedMime === 'image/jpeg') {
        eofOffset = findJpegEOF(buffer);
        formatLabel = 'JPEG';
    } else if (detectedMime === 'image/png') {
        eofOffset = findPngEOF(buffer);
        formatLabel = 'PNG';
    } else if (detectedMime === 'application/pdf') {
        eofOffset = findPdfEOF(buffer);
        formatLabel = 'PDF';
    }

    if (eofOffset === null || eofOffset >= buffer.length) return { detected: false };

    const tail = buffer.slice(eofOffset);
    const meaningful = tail.filter(
        b => b !== 0x00 && b !== 0x0A && b !== 0x0D && b !== 0x20
    );

    if (meaningful.length > 8) {
        return {
            detected: true,
            reason: `${formatLabel}: ${meaningful.length} bytes of data found after EOF marker (offset ${eofOffset})`
        };
    }
    return { detected: false };
};


// ─────────────────────────────────────────────────────────
// 4. POLYGLOT DETECTION (STRUCTURE‑AWARE)
// ─────────────────────────────────────────────────────────

// -- 4.1 ZIP structural validator --
const findZipEOCD = (buffer) => {
    const EOCD_SIG = 0x06054b50;
    const maxSearch = Math.min(buffer.length, 0xFFFF + 22);
    for (let i = buffer.length - 22; i >= buffer.length - maxSearch; i--) {
        if (i < 0) break;
        if (buffer.readUInt32LE(i) === EOCD_SIG) return i;
    }
    return -1;
};

const validateZipStructure = (buffer) => {
    const eocdOffset = findZipEOCD(buffer);
    if (eocdOffset === -1) return false;

    try {
        const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
        const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

        // Sanity: must have entries, but not a bomb
        if (totalEntries === 0 || totalEntries > 1000) return false;
        if (centralDirOffset >= buffer.length) return false;

        // Central directory header
        if (buffer.readUInt32LE(centralDirOffset) !== 0x02014b50) return false;

        // Must contain at least one local file header (anywhere)
        if (buffer.indexOf(ZIP_LOCAL_FILE_HEADER) === -1) return false;

        return true;
    } catch {
        return false;
    }
};

// -- 4.2 PNG structural validator --
const validatePngStructure = (buffer) => {
    if (!buffer.slice(0, 8).equals(PNG_SIGNATURE)) return false;

    let offset = 8;
    let seenIHDR = false;
    let seenIEND = false;

    try {
        while (offset + 12 <= buffer.length) {
            const length = buffer.readUInt32BE(offset);
            const type = buffer.slice(offset + 4, offset + 8).toString('ascii');

            if (offset + 12 + length > buffer.length) return false;

            if (type === 'IHDR') {
                if (offset !== 8) return false;   // IHDR must be first
                seenIHDR = true;
            }

            if (type === 'IEND') {
                seenIEND = true;
                break;
            }

            offset += 12 + length;
        }
    } catch {
        return false;
    }

    return seenIHDR && seenIEND;
};

// -- 4.3 PDF structural validator --
const validatePdfStructure = (buffer) => {
    const content = buffer.toString('latin1');

    // Basic header
    if (!content.startsWith('%PDF-')) return false;

    // Object / endobj pair must exist
    if (!/obj[\s\S]+?endobj/.test(content)) return false;

    // Root reference must exist (catalog)
    if (!/\/Root\s+\d+\s+\d+\s+R/.test(content)) return false;

    // xref / trailer / startxref
    if (content.lastIndexOf('xref') === -1 ||
        content.lastIndexOf('trailer') === -1 ||
        content.lastIndexOf('startxref') === -1) {
        return false;
    }

    // startxref offset must be inside file
    const startxrefIndex = content.lastIndexOf('startxref');
    try {
        const offsetStr = content.substring(startxrefIndex + 9).trim().split(/\s+/)[0];
        const offsetVal = parseInt(offsetStr, 10);
        if (isNaN(offsetVal) || offsetVal >= buffer.length) return false;
    } catch {
        return false;
    }

    return true;
};

// -- 4.4 Main polyglot detector --
export const detectPolyglotFile = (buffer, detectedMime) => {
    if (!POLYGLOT_TARGET_MIMES.has(detectedMime)) {
        return { detected: false };
    }

    // ---------- ZIP ----------
    const zipOffset = buffer.indexOf(ZIP_LOCAL_FILE_HEADER, POLYGLOT_MIN_OFFSET);
    if (zipOffset !== -1) {
        const nearEOF = (buffer.length - zipOffset) <= POLYGLOT_NEAR_EOF;
        if (nearEOF && validateZipStructure(buffer)) {
            return {
                detected: true,
                reason: `Valid ZIP structure detected at offset ${zipOffset} inside ${detectedMime}`
            };
        }
    }

    // ---------- Embedded PDF ----------
    const pdfStr = '%PDF-';
    const pdfOffset = buffer.indexOf(pdfStr, POLYGLOT_MIN_OFFSET);
    if (pdfOffset !== -1) {
        const sliced = buffer.slice(pdfOffset);
        if (validatePdfStructure(sliced)) {
            return {
                detected: true,
                reason: `Embedded valid PDF detected at offset ${pdfOffset}`
            };
        }
    }

    // ---------- Embedded PNG ----------
    const pngOffset = buffer.indexOf(PNG_SIGNATURE, POLYGLOT_MIN_OFFSET);
    if (pngOffset !== -1) {
        const sliced = buffer.slice(pngOffset);
        if (validatePngStructure(sliced)) {
            return {
                detected: true,
                reason: `Embedded valid PNG detected at offset ${pngOffset}`
            };
        }
    }

    return { detected: false };
};


// ─────────────────────────────────────────────────────────
// 5. PDF EMBEDDED THREAT SCANNER
// ─────────────────────────────────────────────────────────
const PDF_DANGEROUS_PATTERNS = [
    { pattern: /\/JS\s*[\s(<]/,           label: '/JS action' },
    { pattern: /\/JavaScript\s*[\s(<]/,   label: '/JavaScript action' },
    { pattern: /\/AA\s*<</,               label: '/AA (Additional Actions) dict' },
    { pattern: /\/OpenAction\s*[\s(<[/]/, label: '/OpenAction trigger' },
    { pattern: /\/Launch\s*<</,           label: '/Launch action (can run executables)' },
    { pattern: /\/SubmitForm/,            label: '/SubmitForm (data exfiltration)' },
    { pattern: /\/ImportData/,            label: '/ImportData (external data injection)' },
    { pattern: /\/Type\s*\/EmbeddedFile/,      label: '/Type /EmbeddedFile (embedded file)' },
    { pattern: /\/Subtype\s*\/FileAttachment/, label: '/Subtype /FileAttachment (file attachment)' },
];

export const scanPdfForEmbeddedThreats = (buffer) => {
    const content = buffer.toString('latin1');
    for (const { pattern, label } of PDF_DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
            return { detected: true, reason: `PDF contains dangerous element: ${label}` };
        }
    }
    return { detected: false };
};


// ─────────────────────────────────────────────────────────
// 6. JPEG EXIF STRIPPER
// ─────────────────────────────────────────────────────────
const JPEG_STRIP_MARKERS = new Set([
    0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7,
    0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF,
    0xFE,
]);

export const stripJpegExif = (buffer) => {
    if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) return buffer;

    const kept = [Buffer.from([0xFF, 0xD8])];
    let offset = 2;

    try {
        while (offset < buffer.length - 1) {
            if (buffer[offset] !== 0xFF) {
                kept.push(buffer.slice(offset));
                break;
            }
            const marker = buffer[offset + 1];

            if (marker === 0xD9) {
                kept.push(Buffer.from([0xFF, 0xD9]));
                break;
            }
            if (marker === 0xDA) {
                kept.push(buffer.slice(offset));
                break;
            }
            if (marker >= 0xD0 && marker <= 0xD8) {
                kept.push(Buffer.from([0xFF, marker]));
                offset += 2;
                continue;
            }
            if (offset + 3 >= buffer.length) break;
            const segLength = buffer.readUInt16BE(offset + 2);
            const segEnd = offset + 2 + segLength;

            if (!JPEG_STRIP_MARKERS.has(marker)) {
                kept.push(buffer.slice(offset, segEnd));
            }
            offset = segEnd;
        }
    } catch {
        console.warn('[STEG] JPEG EXIF parser error — returning original buffer');
        return buffer;
    }

    const result = Buffer.concat(kept);
    const savedBytes = buffer.length - result.length;
    if (savedBytes > 0) console.log(`[STEG] JPEG: stripped ${savedBytes} bytes of metadata`);
    return result;
};


// ─────────────────────────────────────────────────────────
// 7. PNG METADATA STRIPPER
// ─────────────────────────────────────────────────────────
const PNG_STRIP_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

export const stripPngMetadata = (buffer) => {
    if (buffer.length < 8 || !buffer.slice(0, 8).equals(PNG_SIGNATURE)) return buffer;

    const kept = [PNG_SIGNATURE];
    let offset = 8;
    let strippedCount = 0;

    try {
        while (offset + 12 <= buffer.length) {
            const dataLength = buffer.readUInt32BE(offset);
            const chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');
            const totalChunk = 4 + 4 + dataLength + 4;

            if (offset + totalChunk > buffer.length) break;

            if (PNG_STRIP_CHUNKS.has(chunkType)) {
                strippedCount++;
            } else {
                kept.push(buffer.slice(offset, offset + totalChunk));
            }

            offset += totalChunk;
            if (chunkType === 'IEND') break;
        }
    } catch {
        console.warn('[STEG] PNG metadata parser error — returning original buffer');
        return buffer;
    }

    if (strippedCount > 0) console.log(`[STEG] PNG: stripped ${strippedCount} metadata chunk(s)`);
    return Buffer.concat(kept);
};


// ─────────────────────────────────────────────────────────
// 8. SHANNON ENTROPY CHECK
// ─────────────────────────────────────────────────────────
export const checkFileEntropy = (buffer, detectedMime) => {
    if (SKIP_ENTROPY_MIMES.has(detectedMime)) {
        return { flagged: false, skipped: true };
    }

    const sample = buffer.slice(0, Math.min(ENTROPY_SAMPLE_BYTES, buffer.length));
    const freq = new Uint32Array(256);

    for (const byte of sample) freq[byte]++;

    let entropy = 0;
    const len = sample.length;

    for (const count of freq) {
        if (count === 0) continue;
        const p = count / len;
        entropy -= p * Math.log2(p);
    }

    const entropyFixed = parseFloat(entropy.toFixed(3));

    if (entropyFixed > ENTROPY_THRESHOLD) {
        return {
            flagged: true,
            entropy: entropyFixed,
            reason: `Suspicious entropy (${entropyFixed} bits/byte > threshold ${ENTROPY_THRESHOLD}) — possible hidden encrypted payload`
        };
    }

    return { flagged: false, entropy: entropyFixed };
};


// ─────────────────────────────────────────────────────────
// 9. MAIN RUNNER
// ─────────────────────────────────────────────────────────
export const runStegChecks = (file, detectedMime) => {
    let workingBuffer = file.buffer;

    // 1. PDF embedded JavaScript / dangerous actions
    if (detectedMime === 'application/pdf') {
        const pdfCheck = scanPdfForEmbeddedThreats(workingBuffer);
        if (pdfCheck.detected) {
            console.warn(`[STEG BLOCK] "${file.originalname}": ${pdfCheck.reason}`);
            return { clean: false, reason: pdfCheck.reason };
        }
    }

    // 2. Data after EOF
    const eofCheck = checkDataAfterEOF(workingBuffer, detectedMime);
    if (eofCheck.detected) {
        console.warn(`[STEG BLOCK] "${file.originalname}": ${eofCheck.reason}`);
        return { clean: false, reason: eofCheck.reason };
    }

    // 3. Polyglot detection
    const polyCheck = detectPolyglotFile(workingBuffer, detectedMime);
    if (polyCheck.detected) {
        console.warn(`[STEG BLOCK] "${file.originalname}": ${polyCheck.reason}`);
        return { clean: false, reason: polyCheck.reason };
    }

    // 4. Metadata stripping
    if (detectedMime === 'image/jpeg') {
        workingBuffer = stripJpegExif(workingBuffer);
    } else if (detectedMime === 'image/png') {
        workingBuffer = stripPngMetadata(workingBuffer);
    }

    // 5. Entropy check
    const entropyCheck = checkFileEntropy(workingBuffer, detectedMime);
    if (entropyCheck.flagged) {
        console.warn(`[STEG BLOCK] "${file.originalname}": ${entropyCheck.reason}`);
        return { clean: false, reason: entropyCheck.reason };
    }

    return { clean: true, strippedBuffer: workingBuffer };
};