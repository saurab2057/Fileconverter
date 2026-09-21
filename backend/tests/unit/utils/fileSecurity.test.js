import { expect } from 'chai';

import {
  ALLOWED_MIME_TYPES,
  MIME_TO_EXTS,
  sanitizeFilename,
  validateFileSecurity,
} from '../../../utils/fileSecurity.js';


describe('fileSecurity utilities', () => {

  // ============================================================
  // MIME configuration
  // ============================================================

  describe('ALLOWED_MIME_TYPES', () => {

    it('should allow PDF files', () => {
      expect(
        ALLOWED_MIME_TYPES.has('application/pdf')
      ).to.equal(true);
    });

    it('should allow PNG files', () => {
      expect(
        ALLOWED_MIME_TYPES.has('image/png')
      ).to.equal(true);
    });

    it('should allow JPEG files', () => {
      expect(
        ALLOWED_MIME_TYPES.has('image/jpeg')
      ).to.equal(true);
    });

    it('should allow MP4 files', () => {
      expect(
        ALLOWED_MIME_TYPES.has('video/mp4')
      ).to.equal(true);
    });

    it('should allow MP3 files', () => {
      expect(
        ALLOWED_MIME_TYPES.has('audio/mpeg')
      ).to.equal(true);
    });

    it('should reject unsupported MIME types', () => {
      expect(
        ALLOWED_MIME_TYPES.has('application/javascript')
      ).to.equal(false);

      expect(
        ALLOWED_MIME_TYPES.has('text/html')
      ).to.equal(false);
    });
  });


  // ============================================================
  // MIME_TO_EXTS
  // ============================================================

  describe('MIME_TO_EXTS', () => {

    it('should map PDF to pdf', () => {
      expect(
        MIME_TO_EXTS['application/pdf']
      ).to.deep.equal(['pdf']);
    });

    it('should map PNG to png', () => {
      expect(
        MIME_TO_EXTS['image/png']
      ).to.deep.equal(['png']);
    });

    it('should map JPEG to jpg and jpeg', () => {
      expect(
        MIME_TO_EXTS['image/jpeg']
      ).to.include.members(['jpg', 'jpeg']);
    });

    it('should map MP4 to mp4 and m4v', () => {
      expect(
        MIME_TO_EXTS['video/mp4']
      ).to.include.members(['mp4', 'm4v']);
    });

    it('should map MP3 to mp3', () => {
      expect(
        MIME_TO_EXTS['audio/mpeg']
      ).to.deep.equal(['mp3']);
    });
  });


  // ============================================================
  // sanitizeFilename()
  // ============================================================

  describe('sanitizeFilename()', () => {

    it('should preserve a normal filename', () => {
      expect(
        sanitizeFilename('report.pdf')
      ).to.equal('report.pdf');
    });

    it('should remove accents and diacritics', () => {
      expect(
        sanitizeFilename('résumé.pdf')
      ).to.equal('resume.pdf');
    });

    it('should remove unsafe filename characters', () => {
      expect(
        sanitizeFilename('report<>:"/\\\\|?*.pdf')
      ).to.equal('report.pdf');
    });

    it('should collapse repeated spaces', () => {
      expect(
        sanitizeFilename('my   report.pdf')
      ).to.equal('my report.pdf');
    });

    it('should collapse repeated hyphens', () => {
      expect(
        sanitizeFilename('my---report.pdf')
      ).to.equal('my report.pdf');
    });

    it('should trim whitespace', () => {
      expect(
        sanitizeFilename('   report.pdf   ')
      ).to.equal('report.pdf');
    });

    it('should return unnamed_file for empty input', () => {
      expect(
        sanitizeFilename('')
      ).to.equal('unnamed_file');
    });

    it('should return unnamed_file for null input', () => {
      expect(
        sanitizeFilename(null)
      ).to.equal('unnamed_file');
    });

    it('should return unnamed_file for undefined input', () => {
      expect(
        sanitizeFilename(undefined)
      ).to.equal('unnamed_file');
    });

    it('should return unnamed_file when all meaningful characters are removed', () => {
      expect(
        sanitizeFilename('<>:?*|')
      ).to.equal('unnamed_file');
    });
  });


  // ============================================================
  // validateFileSecurity()
  // ============================================================

  describe('validateFileSecurity()', () => {

    it('should reject a file with an unknown file type', async () => {
      const file = {
        originalname: 'unknown.bin',
        buffer: Buffer.from(
          'This is not a recognized binary file format.'
        ),
      };

      const result = await validateFileSecurity(
        file,
        'test-user-id'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('message');
    });


    it('should reject an unsupported file type', async () => {
      const file = {
        originalname: 'script.js',
        buffer: Buffer.from(
          '#!/usr/bin/env node\nconsole.log("hello")'
        ),
      };

      const result = await validateFileSecurity(
        file,
        'test-user-id'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('message');
    });


    it('should reject a file with a mismatched extension', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n' +
        '<< /Type /Catalog >>\n' +
        'endobj\n' +
        '%%EOF'
      );

      const file = {
        originalname: 'document.txt',
        buffer: pdfBuffer,
      };

      const result = await validateFileSecurity(
        file,
        'test-user-id'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('message');
    });


    it('should reject a recognized file with no extension', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n' +
        '<< /Type /Catalog >>\n' +
        'endobj\n' +
        '%%EOF'
      );

      const file = {
        originalname: 'document',
        buffer: pdfBuffer,
      };

      const result = await validateFileSecurity(
        file,
        'test-user-id'
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('message');
    });


    it('should return a safe error instead of throwing for invalid buffer input', async () => {
      const file = {
        originalname: 'broken.pdf',
        buffer: null,
      };

      const result = await validateFileSecurity(
        file,
        'test-user-id'
      );

      expect(result).to.be.an('object');

      expect(result.message).to.equal(
        'Security validation failed. Please try again.'
      );
    });
  });
});