import { Injectable } from '@angular/core';

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable({ providedIn: 'root' })
export class DocGenerationService {
  /** Sustituye {{key}} por su valor (escapado). Los no rellenados quedan vacíos. */
  interpolate(html: string, values: Record<string, string>): string {
    return html.replace(PLACEHOLDER_REGEX, (_, key: string) => escapeHtml(values[key] ?? ''));
  }

  /**
   * Igual que interpolate, pero los marcadores quedan resaltados.
   * Clases (no estilos inline): el sanitizer de Angular elimina `style` pero conserva `class`.
   */
  interpolateForPreview(html: string, values: Record<string, string>): string {
    return html.replace(PLACEHOLDER_REGEX, (_, key: string) => {
      const value = values[key];
      if (value) {
        return `<mark class="rounded bg-emerald-100 px-0.5 text-emerald-800">${escapeHtml(value)}</mark>`;
      }
      return `<mark class="rounded bg-amber-100 px-0.5 text-amber-800">{{${escapeHtml(key)}}}</mark>`;
    });
  }

  async copyToClipboard(renderedHtml: string): Promise<void> {
    const plainText = this.htmlToPlainText(renderedHtml);
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([renderedHtml], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
    } catch {
      // Fallback: solo texto plano (contextos sin ClipboardItem)
      await navigator.clipboard.writeText(plainText);
    }
  }

  async downloadAsDocx(renderedHtml: string, fileName: string): Promise<void> {
    const { default: htmlToDocx } = await import('html-to-docx');
    const documentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${renderedHtml}</body></html>`;
    const result = await htmlToDocx(documentHtml, null, {
      orientation: 'portrait',
      title: fileName,
    });
    const blob = result instanceof Blob
      ? result
      : new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private htmlToPlainText(html: string): string {
    const container = document.createElement('div');
    container.innerHTML = html;
    return container.innerText.trim();
  }
}
