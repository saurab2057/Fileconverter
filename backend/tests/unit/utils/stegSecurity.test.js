import { expect } from 'chai';

import {
  scanPdfForEmbeddedThreats,
  detectPolyglotFile,
  stripJpegExif,
  stripPngMetadata,
  checkFileEntropy,
  runStegChecks,
} from '../../../utils/stegSecurity.js';

describe('stegSecurity utilities', () => {
  // ─────────────────────────────────────────────────────────
  // scanPdfForEmbeddedThreats()
  // Verifies that dangerous PDF actions and embedded-file
  // constructs are detected while normal PDFs are allowed.
  // ─────────────────────────────────────────────────────────
  describe('scanPdfForEmbeddedThreats()', () => {
    it('should allow a normal PDF', () => {
      const pdf = Buffer.from(
        '%PDF-1.7\n' +
        '1 0 obj\n' +
        '<< /Type /Catalog >>\n' +
        'endobj\n' +
        '%%EOF'
      );

      const result = scanPdfForEmbeddedThreats(pdf);

      expect(result).to.be.an('object');
      expect(result).to.have.property('detected', false);
    });

    const threats = [
      '/JS',
      '/JavaScript',
      '/Launch <<',
      '/SubmitForm',
      '/ImportData',
      '/Type /EmbeddedFile',
      '/Subtype /FileAttachment',
    ];

    threats.forEach((threat) => {
      it(`should detect ${threat}`, () => {
        const pdf = Buffer.from(
          `%PDF-1.7\n1 0 obj\n<< ${threat} >>\nendobj\n%%EOF`
        );

        const result = scanPdfForEmbeddedThreats(pdf);

        expect(result).to.be.an('object');
        expect(result).to.have.property('detected', true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // detectPolyglotFile()
  // Verifies that unsupported MIME types are ignored and that
  // ordinary JPEG/PNG files are not falsely identified as
  // polyglot files.
  // ─────────────────────────────────────────────────────────
  describe('detectPolyglotFile()', () => {
    it('should ignore unsupported MIME types', () => {
      const buffer = Buffer.from('ordinary data');

      const result = detectPolyglotFile(
        buffer,
        'text/plain'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('detected', false);
    });

    it('should not flag an ordinary JPEG as a polyglot', () => {
      const jpeg = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xd9,
      ]);

      const result = detectPolyglotFile(
        jpeg,
        'image/jpeg'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('detected', false);
    });

    it('should not flag an ordinary PNG as a polyglot', () => {
      const png = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]);

      const result = detectPolyglotFile(
        png,
        'image/png'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('detected', false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // stripJpegExif()
  // Verifies that JPEG metadata can be removed without
  // damaging the required JPEG SOI/EOI markers.
  // ─────────────────────────────────────────────────────────
  describe('stripJpegExif()', () => {
    it('should return non-JPEG data unchanged', () => {
      const input = Buffer.from('not a jpeg');

      const result = stripJpegExif(input);

      expect(Buffer.isBuffer(result)).to.equal(true);
      expect(result.equals(input)).to.equal(true);
    });

    it('should preserve JPEG SOI and EOI markers', () => {
      const jpeg = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe1,
        0x00,
        0x05,
        0x01,
        0x02,
        0x03,
        0xff,
        0xd9,
      ]);

      const result = stripJpegExif(jpeg);

      expect(result[0]).to.equal(0xff);
      expect(result[1]).to.equal(0xd8);

      expect(result[result.length - 2]).to.equal(0xff);
      expect(result[result.length - 1]).to.equal(0xd9);
    });

    it('should not throw on malformed JPEG data', () => {
      const malformed = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe1,
        0x00,
      ]);

      expect(() => stripJpegExif(malformed)).to.not.throw();
    });
  });

  // ─────────────────────────────────────────────────────────
  // stripPngMetadata()
  // Verifies that PNG metadata processing does not corrupt
  // the PNG signature and safely handles malformed data.
  // ─────────────────────────────────────────────────────────
  describe('stripPngMetadata()', () => {
    it('should return non-PNG data unchanged', () => {
      const input = Buffer.from('not a png');

      const result = stripPngMetadata(input);

      expect(Buffer.isBuffer(result)).to.equal(true);
      expect(result.equals(input)).to.equal(true);
    });

    it('should preserve the PNG signature', () => {
      const png = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]);

      const result = stripPngMetadata(png);

      expect(
        result.subarray(0, 8).equals(
          png.subarray(0, 8)
        )
      ).to.equal(true);
    });

    it('should not throw on malformed PNG data', () => {
      const malformed = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        0x00,
        0x00,
      ]);

      expect(() => stripPngMetadata(malformed)).to.not.throw();
    });
  });

  // ─────────────────────────────────────────────────────────
  // checkFileEntropy()
  // Verifies low/high entropy handling and confirms that
  // compressed formats configured by the application are
  // excluded from entropy inspection.
  // ─────────────────────────────────────────────────────────
  describe('checkFileEntropy()', () => {
    it('should not flag empty data', () => {
      const result = checkFileEntropy(
        Buffer.alloc(0),
        'application/octet-stream'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('flagged', false);
    });

    it('should not flag low-entropy data', () => {
      const data = Buffer.alloc(
        4096,
        0x41
      );

      const result = checkFileEntropy(
        data,
        'application/octet-stream'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('flagged', false);
    });

    it('should skip MIME types configured to bypass entropy checks', () => {
      const data = Buffer.alloc(
        4096,
        0x41
      );

      const result = checkFileEntropy(
        data,
        'video/mp4'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('flagged', false);
      expect(result).to.have.property('skipped', true);
    });

    it('should detect high-entropy data', () => {
      const data = Buffer.alloc(
        64 * 1024
      );

      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const result = checkFileEntropy(
        data,
        'application/octet-stream'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('flagged', true);
      expect(result.entropy).to.be.greaterThan(7.8);
    });
  });

  // ─────────────────────────────────────────────────────────
  // runStegChecks()
  // IMPORTANT:
  // runStegChecks() expects a Multer-style file object because
  // the production function accesses file.buffer and
  // file.originalname. Therefore the tests must pass an object
  // containing those properties instead of passing a Buffer
  // directly.
  // ─────────────────────────────────────────────────────────
  describe('runStegChecks()', () => {
    it('should return an object containing clean for a normal PDF', () => {
      const pdf = Buffer.from(
        '%PDF-1.7\n' +
        '1 0 obj\n' +
        '<< /Type /Catalog >>\n' +
        'endobj\n' +
        '%%EOF'
      );

      const file = {
        buffer: pdf,
        originalname: 'test.pdf',
      };

      const result = runStegChecks(
        file,
        'application/pdf'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('clean', true);
      expect(result.strippedBuffer).to.be.instanceOf(Buffer);
    });

    it('should block PDF JavaScript', () => {
      const pdf = Buffer.from(
        '%PDF-1.7\n' +
        '1 0 obj\n' +
        '<< /JS (alert) >>\n' +
        'endobj\n' +
        '%%EOF'
      );

      const file = {
        buffer: pdf,
        originalname: 'malicious.pdf',
      };

      const result = runStegChecks(
        file,
        'application/pdf'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('clean', false);
    });

    it('should process JPEG metadata stripping', () => {
      const jpeg = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe1,
        0x00,
        0x05,
        0x01,
        0x02,
        0x03,
        0xff,
        0xd9,
      ]);

      const file = {
        buffer: jpeg,
        originalname: 'test.jpg',
      };

      const result = runStegChecks(
        file,
        'image/jpeg'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('clean', true);
      expect(result.strippedBuffer).to.be.instanceOf(Buffer);
    });

    it('should process PNG metadata stripping', () => {
      const png = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        0x00,
        0x00,
        0x00,
        0x00,
        0x49,
        0x45,
        0x4e,
        0x44,
        0xae,
        0x42,
        0x60,
        0x82,
      ]);

      const file = {
        buffer: png,
        originalname: 'test.png',
      };

      const result = runStegChecks(
        file,
        'image/png'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('clean', true);
      expect(result.strippedBuffer).to.be.instanceOf(Buffer);
    });
  });
});