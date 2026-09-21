import { inject, Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Invoice, InvoiceLinea } from './invoice.service';
import { normalizeLinea } from './invoice.service';
import { CompanyService, getLabelIdentificacion } from './company.service';
import type { Company } from './company.service';

@Injectable({ providedIn: 'root' })
export class InvoicePdfService {
  private readonly storage = inject(Storage);
  private readonly companyService = inject(CompanyService);

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

  private async buildPdf(invoice: Invoice, company: Company): Promise<Blob> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageW = 210;
    const right = pageW - margin;

    // ── Company block (left) ────────────────────────────────────────────────
    let y = 22;
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
      if (invoice.clienteNif) { doc.text(`NIF/CIF: ${invoice.clienteNif}`, margin, cy); cy += 5; }
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
    doc.text(this.formatMoney(invoice.amount) + ' €', right, tY, { align: 'right' });
    tY += 6;

    // Per-rate IVA breakdown
    const ivaGroups = this.groupByIvaRate(lineas, globalIvaRate);
    for (const [pct, { cuota }] of ivaGroups) {
      doc.text(`IVA (${pct}%)`, labelX, tY);
      doc.text(this.formatMoney(cuota) + ' €', right, tY, { align: 'right' });
      tY += 6;
    }
    if (ivaGroups.size === 0) {
      doc.text('IVA', labelX, tY);
      doc.text(this.formatMoney(invoice.vat) + ' €', right, tY, { align: 'right' });
      tY += 6;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(labelX, tY - 3, right, tY - 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('TOTAL', labelX, tY + 4);
    doc.text(this.formatMoney(invoice.total) + ' €', right, tY + 4, { align: 'right' });

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
    if (invoice.verifactu?.estado === 'enviado' && invoice.verifactu.csv) {
      const csv = invoice.verifactu.csv;
      // Usar la URL del portal de verificación ciudadano (generada por verifactu-client.generateQrUrl)
      const qrUrl = invoice.verifactu.qrUrl
        ?? `https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV/cont/index.html?nif=&numserie=${encodeURIComponent(invoice.invoiceNumber)}&importe=${invoice.total.toFixed(2)}`;
      const qrDataUrl = await this.generateQrDataUrl(qrUrl);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', margin, 263, 22, 22);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text('Verificar en AEAT', margin, 287);
        doc.setFontSize(7.5);
        doc.text(`CSV: ${csv}`, margin + 25, 270);
        doc.text('Factura registrada en Verifactu · Sistema de Facturación Verificable', margin + 25, 276);
      } else {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text(`Factura registrada en Verifactu (AEAT) · CSV: ${csv}`, margin, 275);
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

  private groupByIvaRate(lineas: InvoiceLinea[], globalRate: number): Map<number, { base: number; cuota: number }> {
    const groups = new Map<number, { base: number; cuota: number }>();
    for (const l of lineas) {
      if (!l.aplicaIva) continue;
      const rate = l.ivaRate ?? globalRate;
      const pct = Math.round(rate * 100);
      const existing = groups.get(pct) ?? { base: 0, cuota: 0 };
      existing.base += l.base;
      existing.cuota += l.base * rate;
      groups.set(pct, existing);
    }
    return groups;
  }
}
