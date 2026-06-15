declare module 'mammoth' {
  export interface MammothMessage {
    type: string;
    message: string;
  }
  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: Record<string, unknown>
  ): Promise<MammothResult>;
}

declare module 'html-to-docx' {
  export default function htmlToDocx(
    htmlString: string,
    headerHtmlString?: string | null,
    options?: Record<string, unknown>,
    footerHtmlString?: string | null
  ): Promise<Blob | ArrayBuffer>;
}
