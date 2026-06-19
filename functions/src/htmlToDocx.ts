import { onCall, HttpsError } from 'firebase-functions/v2/https';

// html-to-docx no tiene tipos oficiales de TypeScript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const htmlToDocx = require('html-to-docx') as (
  html: string,
  header: null,
  options: Record<string, unknown>
) => Promise<Buffer>;

interface GenerateDocxRequest {
  html: string;
  fileName?: string;
}

interface GenerateDocxResponse {
  docx: string;
}

export const generateDocx = onCall<GenerateDocxRequest, Promise<GenerateDocxResponse>>(
  { enforceAppCheck: false, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticación requerida');
    }

    const { html, fileName } = request.data;
    if (!html) throw new HttpsError('invalid-argument', 'Falta el parámetro html');

    const documentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
    const result = await htmlToDocx(documentHtml, null, {
      orientation: 'portrait',
      title: fileName ?? 'documento',
    });

    const buffer = Buffer.isBuffer(result) ? result : Buffer.from(result as ArrayBuffer);
    return { docx: buffer.toString('base64') };
  }
);
