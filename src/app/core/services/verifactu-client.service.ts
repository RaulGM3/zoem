import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from '@angular/fire/firestore';
import { CompanyService, getIdentificacionFiscal } from './company.service';
import type { Invoice } from './invoice.service';
import { normalizeLinea } from './invoice.service';
import type {
  VerifactuDesgloseIVA,
  VerifactuEstado,
  VerifactuIDFactura,
  VerifactuRegistro,
  VerifactuRegistroBaja,
} from '../../interfaces/verifactu.interface';

@Injectable({ providedIn: 'root' })
export class VerifactuClientService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  /**
   * Construye el RegistroFactura según la spec AEAT Verifactu v1.0.
   * El campo HuellaAnterior debe ser la huella SHA-256 de la factura anterior
   * de esta empresa (o cadena vacía si es la primera).
   */
  buildRegistro(invoice: Invoice, huellaAnterior: string): VerifactuRegistro {
    const company = this.companyService.activeCompany();
    if (!company) throw new Error('No active company');
    const identificacion = getIdentificacionFiscal(company);
    if (!identificacion) {
      const label = company.tipoPersona === 'fisica' ? 'NIF' : 'CIF';
      throw new Error(`La empresa no tiene ${label} configurado`);
    }

    const [year, month, day] = invoice.issueDate.split('-');
    const fechaAeat = `${day}-${month}-${year}`; // dd-mm-yyyy

    const idFactura: VerifactuIDFactura = {
      NIF: identificacion,
      NumSerieFactura: invoice.invoiceNumber,
      FechaExpedicionFactura: fechaAeat,
    };

    // Desglose: una línea por tipo impositivo aplicado, agrupando por tasa
    const globalRate = invoice.ivaRate ?? 0;
    const lineas = (invoice.lineas ?? []).map(l => normalizeLinea(l));
    const rateGroups = new Map<number, { base: number; cuota: number }>();

    for (const l of lineas) {
      if (!l.aplicaIva) continue;
      const rate = l.ivaRate ?? globalRate;
      const pct = Math.round(rate * 100);
      const existing = rateGroups.get(pct) ?? { base: 0, cuota: 0 };
      existing.base += l.base;
      existing.cuota += l.base * rate;
      rateGroups.set(pct, existing);
    }

    const desglose: VerifactuDesgloseIVA[] = [];
    if (rateGroups.size > 0) {
      for (const [pct, { base, cuota }] of rateGroups) {
        desglose.push({
          BaseImponibleOImporteNoSujeto: base,
          TipoImpositivo: pct,
          CuotaRepercutida: cuota,
        });
      }
    } else {
      // Operación exenta / sin IVA
      desglose.push({
        BaseImponibleOImporteNoSujeto: invoice.amount,
        TipoImpositivo: 0,
        CuotaRepercutida: 0,
      });
    }

    // Descripción derivada de los conceptos de la factura (max 500 chars per spec AEAT)
    const descripcion = lineas.map(l => l.concepto).filter(Boolean).join(', ').slice(0, 500)
      || 'Servicios profesionales';

    // Timestamp en timezone española sin milisegundos
    const now = this.madridTimestamp();

    return {
      IDFactura: idFactura,
      NombreRazonEmisor: company.name,
      TipoFactura: invoice.tipoFactura ?? 'F1',
      DescripcionOperacion: descripcion,
      NIF: invoice.clienteNif || undefined,
      NombreDestinatario: invoice.clienteNombre || undefined,
      Desglose: desglose,
      CuotaTotal: invoice.vat,
      ImporteTotal: invoice.total,
      HuellaAnterior: huellaAnterior,
      FechaHoraHusoGenRegistro: now,
    };
  }

  /**
   * Calcula el SHA-256 hex del registro según la spec AEAT.
   * Cadena de entrada: NIF&NumSerie&Fecha&TipoFactura&CuotaTotal&ImporteTotal&HuellaAnterior&FechaHoraGenRegistro
   */
  async computeHash(registro: VerifactuRegistro): Promise<string> {
    const { IDFactura, TipoFactura, CuotaTotal, ImporteTotal, HuellaAnterior, FechaHoraHusoGenRegistro } = registro;

    const input = [
      IDFactura.NIF,
      IDFactura.NumSerieFactura,
      IDFactura.FechaExpedicionFactura,
      TipoFactura,
      CuotaTotal.toFixed(2),
      ImporteTotal.toFixed(2),
      HuellaAnterior,
      FechaHoraHusoGenRegistro,
    ].join('&');

    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Genera la URL de verificación para el QR de la factura (formato AEAT).
   * https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/
   * es/aeat/tikeV/cont/index.html?nif=NIF&numserie=NUM&fecha=FECHA&importe=IMPORTE
   */
  generateQrUrl(registro: VerifactuRegistro): string {
    const base = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV/cont/index.html';
    const params = new URLSearchParams({
      nif: registro.IDFactura.NIF,
      numserie: registro.IDFactura.NumSerieFactura,
      fecha: registro.IDFactura.FechaExpedicionFactura,
      importe: registro.ImporteTotal.toFixed(2),
    });
    return `${base}?${params.toString()}`;
  }

  /**
   * Recupera la huella SHA-256 de la última factura enviada a Verifactu
   * para esta empresa. Devuelve cadena vacía si es la primera.
   */
  async getLastHuella(companyId: string): Promise<string> {
    console.log('[Verifactu] Buscando última huella para companyId:', companyId);
    const q = query(
      collection(this.firestore, 'invoices'),
      where('companyId', '==', companyId),
      where('verifactu.estado', '==', 'enviado'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    const huella = snap.empty ? '' : ((snap.docs[0].data() as { verifactu?: VerifactuEstado }).verifactu?.huella ?? '');
    console.log('[Verifactu] Última huella:', snap.empty ? '(ninguna — primera factura)' : huella);
    if (snap.empty) return '';
    const data = snap.docs[0].data() as { verifactu?: VerifactuEstado };
    return data.verifactu?.huella ?? '';
  }

  /**
   * Construye el RegistroFactura, calcula su huella y genera el QR en un solo paso.
   * Devuelve el registro enriquecido y el estado inicial para persistir en Firestore.
   */
  async prepareVerifactu(
    invoice: Invoice,
    companyId: string,
  ): Promise<{ registro: VerifactuRegistro; estadoInicial: VerifactuEstado }> {
    const huellaAnterior = await this.getLastHuella(companyId);
    const registro = this.buildRegistro(invoice, huellaAnterior);
    console.log('[Verifactu] buildRegistro resultado:', JSON.stringify(registro, null, 2));

    const huella = await this.computeHash(registro);
    console.log('[Verifactu] SHA-256 calculado:', huella);

    const qrUrl = this.generateQrUrl(registro);
    console.log('[Verifactu] QR URL:', qrUrl);

    const estadoInicial: VerifactuEstado = {
      estado: 'pendiente',
      huella,
      huellaAnterior,
      qrUrl,
    };

    return { registro, estadoInicial };
  }

  /** Construye un RegistroBaja para anular una factura ya registrada en Verifactu. */
  buildRegistroBaja(invoice: Invoice, huellaAnterior: string): VerifactuRegistroBaja {
    const company = this.companyService.activeCompany();
    if (!company) throw new Error('No active company');
    const identificacion = getIdentificacionFiscal(company);
    if (!identificacion) throw new Error('La empresa no tiene NIF/CIF configurado');

    const [year, month, day] = invoice.issueDate.split('-');
    const fechaAeat = `${day}-${month}-${year}`;

    return {
      IDFactura: {
        NIF: identificacion,
        NumSerieFactura: invoice.invoiceNumber,
        FechaExpedicionFactura: fechaAeat,
      },
      NombreRazonEmisor: company.name,
      DescripcionOperacion: `Anulación de factura ${invoice.invoiceNumber}`,
      HuellaAnterior: huellaAnterior,
      FechaHoraHusoGenRegistro: this.madridTimestamp(),
    };
  }

  /** Prepara un registro de baja para enviar a la Cloud Function. */
  async prepareBaja(
    invoice: Invoice,
    companyId: string,
  ): Promise<{ registro: VerifactuRegistroBaja; estadoInicial: VerifactuEstado }> {
    const huellaAnterior = await this.getLastHuella(companyId);
    const registro = this.buildRegistroBaja(invoice, huellaAnterior);

    // Hash de baja: NIF&NumSerie&Fecha&"baja"&HuellaAnterior&FechaHoraGenRegistro
    const input = [
      registro.IDFactura.NIF,
      registro.IDFactura.NumSerieFactura,
      registro.IDFactura.FechaExpedicionFactura,
      'baja',
      registro.HuellaAnterior,
      registro.FechaHoraHusoGenRegistro,
    ].join('&');
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const huella = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    return {
      registro,
      estadoInicial: { estado: 'pendiente', huella, huellaAnterior },
    };
  }

  /**
   * Genera un timestamp ISO-8601 en timezone española (Europe/Madrid) sin milisegundos,
   * con offset explícito. Ej: "2026-09-17T10:30:00+02:00"
   */
  private madridTimestamp(): string {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const dateStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;

    // Calculate offset for Europe/Madrid
    const utc = now.getTime();
    const madridStr = now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
    const madridTime = new Date(madridStr).getTime();
    const offsetMin = Math.round((madridTime - utc) / 60000);
    const sign = offsetMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMin);
    const offH = String(Math.floor(absMin / 60)).padStart(2, '0');
    const offM = String(absMin % 60).padStart(2, '0');

    return `${dateStr}${sign}${offH}:${offM}`;
  }
}
