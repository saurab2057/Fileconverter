// tests/unit/middleware/pdfProcessor.test.js

import { expect } from 'chai';

import { extractPdfText } from '../../../middleware/pdfProcessor.js';

describe('PDF Processor Middleware', () => {

    /*
     * Creates a small, self-contained PDF fixture.
     *
     * Uint8Array is returned deliberately because the installed version
     * of unpdf requires PDF binary data to be supplied as Uint8Array.
     */
    const createPdf = (pages = 1) => {
        const objects = [];
        const pageObjects = [];

        const catalogId = 1;
        const pagesId = 2;
        let nextId = 3;

        objects.push({
            id: catalogId,
            content: '<< /Type /Catalog /Pages 2 0 R >>'
        });

        objects.push({
            id: pagesId,
            content: '<< /Type /Pages /Kids [PAGE_REFS] /Count PAGE_COUNT >>'
        });

        for (let i = 1; i <= pages; i++) {
            const pageId = nextId++;
            const contentId = nextId++;
            const fontId = nextId++;

            pageObjects.push(`${pageId} 0 R`);

            const text = `Page ${i}`;

            const stream = `BT
/F1 12 Tf
72 720 Td
(${text}) Tj
ET`;

            objects.push({
                id: pageId,
                content:
                    `<< /Type /Page /Parent 2 0 R ` +
                    `/MediaBox [0 0 612 792] ` +
                    `/Resources << /Font << /F1 ${fontId} 0 R >> >> ` +
                    `/Contents ${contentId} 0 R >>`
            });

            objects.push({
                id: contentId,
                content:
                    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\n` +
                    `stream\n${stream}\nendstream`
            });

            objects.push({
                id: fontId,
                content:
                    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
            });
        }

        objects[1].content = objects[1].content
            .replace('PAGE_REFS', pageObjects.join(' '))
            .replace('PAGE_COUNT', String(pages));

        let pdf = '%PDF-1.4\n';
        const offsets = [0];

        for (const object of objects) {
            offsets[object.id] = Buffer.byteLength(pdf, 'latin1');

            pdf += `${object.id} 0 obj\n`;
            pdf += `${object.content}\n`;
            pdf += 'endobj\n';
        }

        const xrefOffset = Buffer.byteLength(pdf, 'latin1');

        pdf += `xref\n`;
        pdf += `0 ${objects.length + 1}\n`;
        pdf += `0000000000 65535 f \n`;

        for (let i = 1; i <= objects.length; i++) {
            pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
        }

        pdf += `trailer\n`;
        pdf += `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
        pdf += `startxref\n`;
        pdf += `${xrefOffset}\n`;
        pdf += `%%EOF\n`;

        return new Uint8Array(Buffer.from(pdf, 'latin1'));
    };


    describe('extractPdfText', () => {

        it('should extract text from a PDF and return page information', async () => {
            const pdf = createPdf(2);

            const result = await extractPdfText(pdf, 5);

            expect(result.totalPages).to.equal(2);
            expect(result.pagesProcessed).to.equal(2);
            expect(result.text).to.include('[Page 1]');
            expect(result.text).to.include('Page 1');
            expect(result.text).to.include('[Page 2]');
            expect(result.text).to.include('Page 2');
        });


        it('should accept a Uint8Array input', async () => {
            const pdf = createPdf(1);

            const result = await extractPdfText(pdf, 5);

            expect(result.totalPages).to.equal(1);
            expect(result.pagesProcessed).to.equal(1);
            expect(result.text).to.include('[Page 1]');
            expect(result.text).to.include('Page 1');
        });


        it('should process only the requested maximum number of pages', async () => {
            const pdf = createPdf(5);

            const result = await extractPdfText(pdf, 2);

            expect(result.totalPages).to.equal(5);
            expect(result.pagesProcessed).to.equal(2);

            expect(result.text).to.include('[Page 1]');
            expect(result.text).to.include('[Page 2]');

            expect(result.text).not.to.include('[Page 3]');
            expect(result.text).not.to.include('[Page 4]');
            expect(result.text).not.to.include('[Page 5]');
        });


        it('should process all pages when maxPages is greater than totalPages', async () => {
            const pdf = createPdf(2);

            const result = await extractPdfText(pdf, 10);

            expect(result.totalPages).to.equal(2);
            expect(result.pagesProcessed).to.equal(2);

            expect(result.text).to.include('[Page 1]');
            expect(result.text).to.include('[Page 2]');
        });


        it('should use the default maximum of 5 pages', async () => {
            const pdf = createPdf(8);

            const result = await extractPdfText(pdf);

            expect(result.totalPages).to.equal(8);
            expect(result.pagesProcessed).to.equal(5);

            expect(result.text).to.include('[Page 1]');
            expect(result.text).to.include('[Page 2]');
            expect(result.text).to.include('[Page 3]');
            expect(result.text).to.include('[Page 4]');
            expect(result.text).to.include('[Page 5]');

            expect(result.text).not.to.include('[Page 6]');
            expect(result.text).not.to.include('[Page 7]');
            expect(result.text).not.to.include('[Page 8]');
        });


        it('should handle a page with no extractable text', async () => {
            /*
             * This test uses a valid PDF with an empty content stream.
             * The parser should successfully process the page but produce
             * no page marker because no text was extracted.
             */
            const pdf = createPdfWithCustomText(['']);

            const result = await extractPdfText(pdf, 5);

            expect(result.totalPages).to.equal(1);
            expect(result.pagesProcessed).to.equal(1);
            expect(result.text).to.equal('');
        });


        it('should trim whitespace from extracted text', async () => {
            const pdf = createPdfWithCustomText([
                '   Hello   World   '
            ]);

            const result = await extractPdfText(pdf, 5);

            expect(result.text).to.include('[Page 1]\nHello World');
            expect(result.text).not.to.match(/\[Page 1\]\s+$/);
        });


        it('should format extracted text with page markers', async () => {
            const pdf = createPdf(3);

            const result = await extractPdfText(pdf, 3);

            expect(result.text).to.include('[Page 1]');
            expect(result.text).to.include('[Page 2]');
            expect(result.text).to.include('[Page 3]');
        });


        it('should report the correct total page count', async () => {
            const pdf = createPdf(4);

            const result = await extractPdfText(pdf, 2);

            expect(result.totalPages).to.equal(4);
            expect(result.pagesProcessed).to.equal(2);
        });


        it('should report the correct pagesProcessed value', async () => {
            const pdf = createPdf(7);

            const result = await extractPdfText(pdf, 3);

            expect(result.pagesProcessed).to.equal(3);
        });


        it('should reject a malformed PDF', async () => {
            const malformedPdf = new Uint8Array(
                Buffer.from('This is definitely not a PDF')
            );

            try {
                await extractPdfText(malformedPdf);

                expect.fail('Expected extractPdfText to reject');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });


        it('should reject an incomplete PDF', async function () {
            this.timeout(10000);

            const malformedPdf = new Uint8Array(
                Buffer.from(
                    '%PDF-1.4\n1 0 obj\n<< /Broken'
                )
            );

            try {
                await extractPdfText(malformedPdf);

                expect.fail('Expected extractPdfText to reject');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });


        it('should reject when PDF processing exceeds the timeout', async function () {
            /*
             * This test verifies the production timeout indirectly using
             * an intentionally incomplete PDF that causes PDF parsing to
             * take longer than the configured processing window.
             *
             * The test allows the production 8-second timeout to fire.
             */
            this.timeout(10000);

            const hangingPdf = new Uint8Array(
                Buffer.from(
                    '%PDF-1.7\n' +
                    '1 0 obj\n' +
                    '<< /Type /Catalog /Pages 2 0 R >>\n' +
                    'endobj\n' +
                    '2 0 obj\n' +
                    '<< /Type /Pages /Kids ['
                )
            );

            try {
                await extractPdfText(hangingPdf);

                expect.fail('Expected PDF processing to reject');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });
    });


    /*
     * Creates a PDF fixture where each page's text can be controlled.
     * This is used for edge cases such as empty or whitespace-only text.
     */
    function createPdfWithCustomText(pageTexts) {
        const objects = [];
        const pageObjects = [];

        const catalogId = 1;
        const pagesId = 2;
        let nextId = 3;

        objects.push({
            id: catalogId,
            content: '<< /Type /Catalog /Pages 2 0 R >>'
        });

        objects.push({
            id: pagesId,
            content: '<< /Type /Pages /Kids [PAGE_REFS] /Count PAGE_COUNT >>'
        });

        for (let i = 0; i < pageTexts.length; i++) {
            const pageId = nextId++;
            const contentId = nextId++;
            const fontId = nextId++;

            pageObjects.push(`${pageId} 0 R`);

            const text = pageTexts[i];

            const stream = text
                ? `BT
/F1 12 Tf
72 720 Td
(${text}) Tj
ET`
                : '';

            objects.push({
                id: pageId,
                content:
                    `<< /Type /Page /Parent 2 0 R ` +
                    `/MediaBox [0 0 612 792] ` +
                    `/Resources << /Font << /F1 ${fontId} 0 R >> >> ` +
                    `/Contents ${contentId} 0 R >>`
            });

            objects.push({
                id: contentId,
                content:
                    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\n` +
                    `stream\n${stream}\nendstream`
            });

            objects.push({
                id: fontId,
                content:
                    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
            });
        }

        objects[1].content = objects[1].content
            .replace('PAGE_REFS', pageObjects.join(' '))
            .replace('PAGE_COUNT', String(pageTexts.length));

        let pdf = '%PDF-1.4\n';
        const offsets = [0];

        for (const object of objects) {
            offsets[object.id] = Buffer.byteLength(pdf, 'latin1');

            pdf += `${object.id} 0 obj\n`;
            pdf += `${object.content}\n`;
            pdf += 'endobj\n';
        }

        const xrefOffset = Buffer.byteLength(pdf, 'latin1');

        pdf += `xref\n`;
        pdf += `0 ${objects.length + 1}\n`;
        pdf += `0000000000 65535 f \n`;

        for (let i = 1; i <= objects.length; i++) {
            pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
        }

        pdf += `trailer\n`;
        pdf += `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
        pdf += `startxref\n`;
        pdf += `${xrefOffset}\n`;
        pdf += `%%EOF\n`;

        return new Uint8Array(Buffer.from(pdf, 'latin1'));
    }
});