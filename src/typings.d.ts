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


