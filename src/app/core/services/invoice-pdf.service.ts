import { inject, Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
// jsPDF + autotable pesan ~140 KB gzip: se cargan al generar el primer PDF, no al abrir Facturación.
import type jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Invoice } from './invoice.service';
import { normalizeLinea } from './invoice.service';
import { totalesRegistro } from '../verifactu/totales-registro';
import { CompanyService, getLabelIdentificacion } from './company.service';
import { CompanyLogoService } from './company-logo.service';
import { encajarLogo } from '../configuracion/logo';
import type { Company } from './company.service';

@Injectable({ providedIn: 'root' })
export class InvoicePdfService {
  private readonly storage = inject(Storage);
  private readonly companyService = inject(CompanyService);
  private readonly logoService = inject(CompanyLogoService);

  async generateAndUpload(invoice: Invoice): Promise<string> {
    const company = this.companyService.activeCompany();
    if (!company?.id) throw new Error('No active company');
    const blob = await this.buildPdf(invoice, company);
    const storageRef = ref(this.storage, `companies/${company.id}/invoices/${invoice.id}.pdf`);
    await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
    return getDownloadURL(storageRef);
  }

  downloadFromUrl(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Dibuja el logo (arriba-izquierda, 40x16 mm máx., proporción preservada).
   * Devuelve la Y del nombre de empresa: bajo el logo si se dibujó, `yPorDefecto` si no.
   * Cualquier fallo (descarga, decodificación) deja el layout original.
   */
  private async dibujarLogo(doc: jsPDF, company: Company, margin: number, yPorDefecto: number): Promise<number> {
    if (!company.logo) return yPorDefecto;
    try {
      const logo = await this.logoService.cargarDataUrl(company.logo);
      const caja = logo ? encajarLogo(logo.w, logo.h) : null;
      if (!logo || !caja) return yPorDefecto;
      const top = 12;
      doc.addImage(logo.dataUrl, logo.format, margin, top, caja.w, caja.h);
      return top + caja.h + 6;
    } catch (err) {
      console.warn('[pdf] no se pudo dibujar el logo:', err);
      return yPorDefecto;
    }
  }

  private async buildPdf(invoice: Invoice, company: Company): Promise<Blob> {
    const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageW = 210;
    const right = pageW - margin;

    // ── Company block (left) ────────────────────────────────────────────────
    let y = 22;
    y = await this.dibujarLogo(doc, company, margin, y);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(company.name, margin, y);

    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);

    const cifLabel = getLabelIdentificacion(company);
    if (company.cif) { doc.text(`${cifLabel}: ${company.cif}`, margin, y); y += 5; }
    if (company.direccion) { doc.text(company.direccion, margin, y); y += 5; }
    if (company.codigoPostal || company.ciudad) { doc.text(`${company.codigoPostal ?? ''} ${company.ciudad ?? ''}`.trim(), margin, y); y += 5; }
    if (company.email) { doc.text(company.email, margin, y); y += 5; }
    if (company.telefono) { doc.text(company.telefono, margin, y); }

    // ── Invoice block (right) ───────────────────────────────────────────────
    const isRectificativa = invoice.tipoFactura === 'R1';
    doc.setFontSize(isRectificativa ? 16 : 22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isRectificativa ? 200 : 41, isRectificativa ? 100 : 98, isRectificativa ? 0 : 255);
    doc.text(isRectificativa ? 'FACTURA RECTIFICATIVA' : 'FACTURA', right, 22, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    let infoY = 32;
    doc.text(`Nº: ${invoice.invoiceNumber}`, right, infoY, { align: 'right' }); infoY += 6;
    doc.text(`Emisión: ${this.formatDate(invoice.issueDate)}`, right, infoY, { align: 'right' }); infoY += 6;
    doc.text(`Vencimiento: ${this.formatDate(invoice.dueDate)}`, right, infoY, { align: 'right' }); infoY += 6;
    if (isRectificativa && invoice.facturaRectificadaNumero) {
      doc.text(`Rectifica: ${invoice.facturaRectificadaNumero}`, right, infoY, { align: 'right' }); infoY += 6;
    }
    if (invoice.casoTitulo) {
      doc.text(`Caso: ${invoice.casoTitulo}`, right, infoY, { align: 'right' });
    }

    // ── Cliente block (left, below company) ─────────────────────────────────
    let clienteEndY = 62;
    if (invoice.clienteNombre) {
      const startY = Math.max(y + 8, 62);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150, 150, 150);
      doc.text('FACTURAR A', margin, startY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(invoice.clienteNombre, margin, startY + 5);

      let cy = startY + 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      if (invoice.clienteNif) {
        const etiqueta = invoice.clienteTipoId === 'extranjero' ? 'Doc. identificación' : 'NIF';
        doc.text(`${etiqueta}: ${invoice.clienteNif}`, margin, cy);
        cy += 5;
      }
      if (invoice.clienteDireccion) {
        const lines = doc.splitTextToSize(invoice.clienteDireccion, 90) as string[];
        doc.text(lines, margin, cy);
        cy += lines.length * 5;
      }
      clienteEndY = cy + 4;
    }

    // ── Divider ─────────────────────────────────────────────────────────────
    const dividerY = Math.max(clienteEndY, 62);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, dividerY, right, dividerY);

    // ── Lines table ─────────────────────────────────────────────────────────
    const lineas = (invoice.lineas ?? []).map(l => normalizeLinea(l));
    const globalIvaRate = invoice.ivaRate ?? 0;
    // Mismos totales (redondeados por grupo) que el registro Verifactu y su QR.
    const totales = totalesRegistro(lineas, globalIvaRate);

    const rows: string[][] = [];
    for (const l of lineas) {
      const effectiveRate = l.aplicaIva ? (l.ivaRate ?? globalIvaRate) : 0;
      const ivaPct = l.aplicaIva ? `${Math.round(effectiveRate * 100)}%` : '—';
      const lineIva = l.base * effectiveRate;
      const concepto = l.descripcion ? `${l.concepto}\n${l.descripcion}` : l.concepto;
      rows.push([
        concepto,
        this.formatQty(l.cantidad),
        this.formatMoney(l.precioUnitario) + ' €',
        this.formatMoney(l.base) + ' €',
        ivaPct,
        this.formatMoney(l.base + lineIva) + ' €',
      ]);
    }

    let tableEndY = dividerY + 8;

    autoTable(doc, {
      startY: dividerY + 6,
      head: [['Concepto', 'Cant.', 'Precio Ud.', 'Base', 'IVA', 'Importe']],
      body: rows,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [41, 98, 255],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 18 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 30 },
      },
      didDrawPage: (data) => { tableEndY = data.cursor?.y ?? tableEndY; },
    });

    // ── Totals block ────────────────────────────────────────────────────────
    let tY = tableEndY + 10;
    const labelX = right - 70;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text('Base imponible', labelX, tY);
    doc.text(this.formatMoney(totales.baseTotal) + ' €', right, tY, { align: 'right' });
    tY += 6;

    // Per-rate IVA breakdown
    for (const { pct, cuota } of totales.grupos) {
      doc.text(`IVA (${pct}%)`, labelX, tY);
      doc.text(this.formatMoney(cuota) + ' €', right, tY, { align: 'right' });
      tY += 6;
    }
    if (totales.grupos.length === 0) {
      doc.text('IVA', labelX, tY);
      doc.text(this.formatMoney(totales.cuotaTotal) + ' €', right, tY, { align: 'right' });
      tY += 6;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(labelX, tY - 3, right, tY - 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('TOTAL', labelX, tY + 4);
    doc.text(this.formatMoney(totales.total) + ' €', right, tY + 4, { align: 'right' });

    // Notes
    if (invoice.notes) {
      const notesY = tY + 14;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      const noteLines = doc.splitTextToSize(invoice.notes, right - margin) as string[];
      doc.text(noteLines, margin, notesY);
    }

    // ── Verifactu footer ────────────────────────────────────────────────────
    // El QR se dibuja siempre que el servidor haya guardado `qrUrl` (desde que se genera el
    // registro, en cualquier estado). Esa URL ya lleva el ImporteTotal redondeado: nunca se
    // reconstruye en el cliente. Sin `qrUrl` (Verifactu no aplica o error de precondición) no se dibuja nada.
    const verifactu = invoice.verifactu;
    if (verifactu?.qrUrl) {
      const csv = verifactu.csv;
      const qrDataUrl = await this.generateQrDataUrl(verifactu.qrUrl);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130, 130, 130);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', margin, 263, 22, 22);
        doc.text('Verificar en AEAT', margin, 287);
        doc.setFontSize(7.5);
        doc.text('VERI*FACTU · Factura verificable en la sede electrónica de la AEAT', margin + 25, 270);
        if (csv) doc.text(`CSV: ${csv}`, margin + 25, 276);
      } else {
        doc.setFontSize(7.5);
        doc.text(`VERI*FACTU (AEAT)${csv ? ` · CSV: ${csv}` : ''}`, margin, 275);
      }
    }

    return doc.output('blob');
  }

  private async generateQrDataUrl(text: string): Promise<string | null> {
    try {
      return await QRCode.toDataURL(text, { width: 88, margin: 1, errorCorrectionLevel: 'M' });
    } catch {
      return null;
    }
  }

  private formatDate(iso: string): string {
    const [yr, mo, da] = iso.split('-');
    return `${da}/${mo}/${yr}`;
  }

  private formatMoney(n: number): string {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatQty(n: number): string {
    return n % 1 === 0 ? String(n) : n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
}
