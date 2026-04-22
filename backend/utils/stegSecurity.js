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
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────
// 1. KNOWN FILE SIGNATURES (MAGIC BYTES)
//    Used by the polyglot detector to find secondary formats
//    embedded inside a file that passed MIME validation.
// ─────────────────────────────────────────────────────────
const SECONDARY_FORMAT_SIGNATURES = [
    {
        label: 'ZIP archive',
        // PK\x03\x04 — used by ZIP, DOCX, XLSX, JAR, APK etc.
        bytes: Buffer.from([0x50, 0x4B, 0x03, 0x04])
    },
    {
        label: 'RAR archive',
        bytes: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07])
    },
    {
        label: 'Windows PE executable',
        // MZ header — .exe, .dll, .sys
        bytes: Buffer.from([0x4D, 0x5A])
    },
    {
        label: 'ELF executable',
        // Linux/Unix binary
        bytes: Buffer.from([0x7F, 0x45, 0x4C, 0x46])
    },
    {
        label: '7-Zip archive',
        bytes: Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])
    },
    {
        label: 'Gzip archive',
        bytes: Buffer.from([0x1F, 0x8B])
    },
];

// These MIME types are already compressed — skip entropy checks.
// Their naturally high entropy would cause constant false positives.
const SKIP_ENTROPY_MIMES = new Set([
    'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm',
    'video/x-matroska', 'video/x-msvideo', 'video/mpeg', 'video/3gpp',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm',
    'audio/3gpp',
]);

// Entropy threshold: normal files rarely exceed 7.5 bits/byte.
// Encrypted or compressed hidden payloads reach 7.8–8.0 bits/byte.
const ENTROPY_THRESHOLD = 7.5;

// Sample the first 64KB — fast and sufficient for entropy detection.
const ENTROPY_SAMPLE_BYTES = 64 * 1024;


// ─────────────────────────────────────────────────────────
// 2. EOF LOCATORS
//    Find where the file legitimately ends so we can check
//    whether anything is hiding after that point.
// ─────────────────────────────────────────────────────────

// JPEG ends with FF D9 (End of Image). Search from the end backwards.
const findJpegEOF = (buffer) => {
    for (let i = buffer.length - 2; i >= 2; i--) {
        if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
            return i + 2; // first byte after EOI marker
        }
    }
    return buffer.length;
};

// PNG ends with IEND chunk: 4-byte length + 4-byte "IEND" + 4-byte CRC.
const findPngEOF = (buffer) => {
    const IEND = Buffer.from([0x49, 0x45, 0x4E, 0x44]); // 'IEND'
    const idx = buffer.lastIndexOf(IEND);
    if (idx !== -1) return idx + 4 + 4; // type(4) + CRC(4)
    return buffer.length;
};

// PDF ends with %%EOF, sometimes followed by a newline.
const findPdfEOF = (buffer) => {
    const EOF_MARKER = Buffer.from('%%EOF');
    const idx = buffer.lastIndexOf(EOF_MARKER);
    if (idx !== -1) return idx + EOF_MARKER.length + 2; // +2 for possible \r\n
    return buffer.length;
};


// ─────────────────────────────────────────────────────────
// 3. DATA-AFTER-EOF DETECTOR
//    Flags meaningful data found beyond the file's end marker.
//    "Meaningful" excludes null bytes and whitespace padding,
//    which some encoders append legitimately.
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

    // Only flag if there's more than 8 non-padding bytes
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
// 4. POLYGLOT FILE DETECTOR
//    Scans for secondary format magic bytes in the file body.
//    We scan the full buffer (not just the tail) because some
//    polyglot techniques embed payloads inside JPEG comment
//    segments or PDF object streams, not only at the end.
//    The first 16 bytes are skipped to avoid false-positives
//    on the primary format's own header.
// ─────────────────────────────────────────────────────────
export const detectPolyglotFile = (buffer, detectedMime) => {
    for (const sig of SECONDARY_FORMAT_SIGNATURES) {
        // For short signatures (MZ = 2 bytes), require a larger offset
        // to reduce false-positives from legitimate binary data patterns
        const searchStart = sig.bytes.length <= 2 ? 64 : 16;
        const region = buffer.slice(searchStart);

        const idx = region.indexOf(sig.bytes);
        if (idx !== -1) {
            return {
                detected: true,
                reason: `Polyglot: "${sig.label}" signature found at offset ${searchStart + idx} inside a ${detectedMime} file`
            };
        }
    }

    // HTML/Script injection embedded in any file type
    const searchStr = buffer.slice(16).toString('latin1');
    if (/<html[\s>]/i.test(searchStr) || /<script[\s>]/i.test(searchStr)) {
        return {
            detected: true,
            reason: 'Polyglot: HTML/script content found embedded in file body'
        };
    }

    return { detected: false };
};


// ─────────────────────────────────────────────────────────
// 5. PDF EMBEDDED THREAT SCANNER
//
//    PDFs support JavaScript natively via dictionary keys.
//    Scripts can execute automatically on open (/OpenAction,
//    /AA), exfiltrate form data (/SubmitForm), or launch
//    external executables (/Launch).
//
//    Scans raw buffer as latin1 — covers uncompressed streams
//    which is the majority of real-world PDFs.
// ─────────────────────────────────────────────────────────
const PDF_DANGEROUS_PATTERNS = [
    { pattern: /\/JS\s*[\s(<]/,          label: '/JS action' },
    { pattern: /\/JavaScript\s*[\s(<]/,  label: '/JavaScript action' },
    { pattern: /\/AA\s*<</,              label: '/AA (Additional Actions) dict' },
    { pattern: /\/OpenAction\s*[\s(<[/]/, label: '/OpenAction trigger' },
    { pattern: /\/Launch\s*<</,          label: '/Launch action (can run executables)' },
    { pattern: /\/SubmitForm/,           label: '/SubmitForm (data exfiltration)' },
    { pattern: /\/ImportData/,           label: '/ImportData (external data injection)' },
    { pattern: /\/EmbeddedFile/,         label: '/EmbeddedFile (file attachment)' },
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
// 6. JPEG EXIF STRIPPER (pure Buffer — no dependencies)
//
//    JPEG structure: [FFD8 SOI] [segments...] [FFD9 EOI]
//    Each segment: [FF marker][2-byte length][data]
//
//    We KEEP:  APP0/0xE0 (JFIF header — required for compat)
//              SOF, DHT, DQT, DRI, SOS, EOI (image structure)
//    We STRIP: APP1/0xE1 (EXIF, XMP metadata)
//              APP2–15   (ICC profiles, Photoshop, multi-picture)
//              COM/0xFE  (comment blocks)
//
//    EXIF fields that are injection vectors if ever logged:
//    Artist, Comment, Copyright, ImageDescription, GPS, Software,
//    Make, Model, UserComment — all stripped by this function.
// ─────────────────────────────────────────────────────────
const JPEG_STRIP_MARKERS = new Set([
    0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7,
    0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF, // APP1–15
    0xFE, // COM (comment)
]);

export const stripJpegExif = (buffer) => {
    if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        return buffer; // not JPEG — fail safe
    }

    const kept = [Buffer.from([0xFF, 0xD8])]; // Start of Image
    let offset = 2;

    try {
        while (offset < buffer.length - 1) {
            if (buffer[offset] !== 0xFF) {
                // Reached raw image data outside a segment — keep rest as-is
                kept.push(buffer.slice(offset));
                break;
            }

            const marker = buffer[offset + 1];

            // End of Image — done
            if (marker === 0xD9) {
                kept.push(Buffer.from([0xFF, 0xD9]));
                break;
            }

            // Start of Scan — everything after is raw compressed data
            if (marker === 0xDA) {
                kept.push(buffer.slice(offset));
                break;
            }

            // RST0–7 and SOI: standalone 2-byte markers, no length field
            if (marker >= 0xD0 && marker <= 0xD8) {
                kept.push(Buffer.from([0xFF, marker]));
                offset += 2;
                continue;
            }

            // All other segments have a 2-byte length field
            if (offset + 3 >= buffer.length) break;
            const segLength = buffer.readUInt16BE(offset + 2); // includes the 2 length bytes
            const segEnd = offset + 2 + segLength;

            if (!JPEG_STRIP_MARKERS.has(marker)) {
                kept.push(buffer.slice(offset, segEnd));
            }
            // else: silently skip (strip) this metadata segment

            offset = segEnd;
        }
    } catch {
        // Parser error — return original so the upload can still proceed
        console.warn('[STEG] JPEG EXIF parser error — returning original buffer');
        return buffer;
    }

    const result = Buffer.concat(kept);
    const savedBytes = buffer.length - result.length;
    if (savedBytes > 0) {
        console.log(`[STEG] JPEG: stripped ${savedBytes} bytes of metadata`);
    }
    return result;
};


// ─────────────────────────────────────────────────────────
// 7. PNG METADATA STRIPPER (pure Buffer — no dependencies)
//
//    PNG structure: [8-byte signature] [chunks...]
//    Each chunk: [4-byte length][4-byte type][data][4-byte CRC]
//
//    Chunks STRIPPED (metadata only):
//      tEXt — plain text key/value pairs (injection vector)
//      iTXt — UTF-8 international text (larger attack surface)
//      zTXt — zlib-compressed text
//      eXIf — EXIF data embedded in PNG (newer spec)
//      tIME — last modification time (info leak)
//
//    All image-critical chunks are preserved:
//      IHDR, IDAT, IEND, PLTE, tRNS, gAMA, cHRM, sRGB etc.
// ─────────────────────────────────────────────────────────
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const PNG_STRIP_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

export const stripPngMetadata = (buffer) => {
    if (buffer.length < 8 || !buffer.slice(0, 8).equals(PNG_SIGNATURE)) {
        return buffer; // not PNG — fail safe
    }

    const kept = [PNG_SIGNATURE];
    let offset = 8;
    let strippedCount = 0;

    try {
        while (offset + 12 <= buffer.length) { // minimum chunk = 12 bytes
            const dataLength = buffer.readUInt32BE(offset);
            const chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');
            const totalChunk = 4 + 4 + dataLength + 4; // length + type + data + CRC

            if (offset + totalChunk > buffer.length) break; // corrupted — stop

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

    if (strippedCount > 0) {
        console.log(`[STEG] PNG: stripped ${strippedCount} metadata chunk(s)`);
    }

    return Buffer.concat(kept);
};


// ─────────────────────────────────────────────────────────
// 8. SHANNON ENTROPY CHECK
//
//    Measures byte-value randomness of the file.
//    Normal uncompressed files: 3.5 – 7.2 bits/byte
//    Encrypted or hidden payloads: typically > 7.5 bits/byte
//
//    Only applied to formats not already compressed (see
//    SKIP_ENTROPY_MIMES above for the skip list).
// ─────────────────────────────────────────────────────────
export const checkFileEntropy = (buffer, detectedMime) => {
    if (SKIP_ENTROPY_MIMES.has(detectedMime)) {
        return { flagged: false, skipped: true };
    }

    const sample = buffer.slice(0, Math.min(ENTROPY_SAMPLE_BYTES, buffer.length));
    const freq = new Uint32Array(256); // byte frequency table

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
// 9. MAIN RUNNER — called from fileSecurity.js
//
//    Returns one of:
//      { clean: true,  strippedBuffer: Buffer }  — safe, use strippedBuffer
//      { clean: false, reason: string }           — block this upload
//
//    Execution order matters:
//      1. PDF JS scan      (block dangerous PDFs immediately)
//      2. Data after EOF   (catch appended payloads)
//      3. Polyglot check   (catch dual-format files)
//      4. Metadata strip   (clean JPEG/PNG before entropy check)
//      5. Entropy check    (run on already-cleaned buffer)
// ─────────────────────────────────────────────────────────
export const runStegChecks = (file, detectedMime) => {
    let workingBuffer = file.buffer;

    // ── 1. PDF embedded JavaScript / dangerous actions ──────
    if (detectedMime === 'application/pdf') {
        const pdfCheck = scanPdfForEmbeddedThreats(workingBuffer);
        if (pdfCheck.detected) {
            console.warn(`[STEG BLOCK] "${file.originalname}": ${pdfCheck.reason}`);
            return { clean: false, reason: pdfCheck.reason };
        }
    }

    // ── 2. Data appended after EOF marker ───────────────────
    const eofCheck = checkDataAfterEOF(workingBuffer, detectedMime);
    if (eofCheck.detected) {
        console.warn(`[STEG BLOCK] "${file.originalname}": ${eofCheck.reason}`);
        return { clean: false, reason: eofCheck.reason };
    }

    // ── 3. Polyglot file detection ───────────────────────────
    const polyCheck = detectPolyglotFile(workingBuffer, detectedMime);
    if (polyCheck.detected) {
        console.warn(`[STEG BLOCK] "${file.originalname}": ${polyCheck.reason}`);
        return { clean: false, reason: polyCheck.reason };
    }

    // ── 4. Strip metadata (returns cleaned buffer) ───────────
    if (detectedMime === 'image/jpeg') {
        workingBuffer = stripJpegExif(workingBuffer);
    } else if (detectedMime === 'image/png') {
        workingBuffer = stripPngMetadata(workingBuffer);
    }

    // ── 5. Entropy analysis on the cleaned buffer ────────────
    const entropyCheck = checkFileEntropy(workingBuffer, detectedMime);
    if (entropyCheck.flagged) {
        console.warn(`[STEG BLOCK] "${file.originalname}": ${entropyCheck.reason}`);
        return { clean: false, reason: entropyCheck.reason };
    }

    return { clean: true, strippedBuffer: workingBuffer };
};