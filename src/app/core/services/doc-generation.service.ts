import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

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
  private readonly functions = inject(Functions);

  interpolate(html: string, values: Record<string, string>): string {
    return html.replace(PLACEHOLDER_REGEX, (_, key: string) => escapeHtml(values[key] ?? ''));
  }

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
      await navigator.clipboard.writeText(plainText);
    }
  }

  async downloadAsDocx(renderedHtml: string, fileName: string): Promise<void> {
    const fn = httpsCallable<{ html: string; fileName: string }, { docx: string }>(
      this.functions,
      'generateDocx'
    );
    const result = await fn({ html: renderedHtml, fileName });

    const byteArray = Uint8Array.from(atob(result.data.docx), (c) => c.charCodeAt(0));
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

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
