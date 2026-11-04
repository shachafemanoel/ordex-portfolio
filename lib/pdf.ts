// Lightweight PDF generation helper.
// Tries to use 'pdfkit' if available; falls back to a tiny valid PDF string.

export async function generateSimplePdf(content: string): Promise<Uint8Array> {
  try {
    // Attempt lazy require of pdfkit without triggering bundler resolution
     
    const req = eval('require') as (m: string) => any;
    const PDFDocument = req('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Uint8Array[] = [];
    return await new Promise<Uint8Array>((resolve, reject) => {
      doc.on('data', (c: Uint8Array) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text(content, { align: 'right' });
      doc.end();
    });
  } catch {
    // Fallback: minimal PDF
    const safe = content.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const pdf = `%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<<>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 62>>stream\nBT /F1 12 Tf 72 100 Td (${safe}) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/Name/F1/BaseFont/Helvetica>>endobj\n6 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 7\n0000000000 65535 f \n0000000010 00000 n \n0000000051 00000 n \n0000000092 00000 n \n0000000285 00000 n \n0000000415 00000 n \n0000000493 00000 n \ntrailer<</Size 7/Root 6 0 R>>\nstartxref\n558\n%%EOF`;
    return Buffer.from(pdf);
  }
}
