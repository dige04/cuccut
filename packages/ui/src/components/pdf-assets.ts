/** PDF.js fonts, CMaps and image decoders are embedded in the package; the packaged file:// build also does not depend on the network or on fetch(file:). */
const assets = import.meta.glob<string>([
  '../../../../node_modules/pdfjs-dist/cmaps/*.bcmap',
  '../../../../node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}',
  '../../../../node_modules/pdfjs-dist/wasm/{jbig2,openjpeg,qcms_bg}.wasm',
], { query: '?inline', import: 'default', eager: true });
const byName = new Map(Object.entries(assets).map(([path, url]) => [path.split('/').pop()!, url]));
export class PdfBinaryData {
  async fetch({ filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const url = byName.get(filename);
    if (!url) throw new Error(`PDF_ASSET_MISSING: ${filename}`);
    const encoded = url.slice(url.indexOf(',') + 1);
    const text = url.slice(0, url.indexOf(',')).endsWith(';base64') ? atob(encoded) : decodeURIComponent(encoded);
    return Uint8Array.from(text, ch => ch.charCodeAt(0));
  }
}
