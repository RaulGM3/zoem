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
import { CompanyService } from './company.service';
import type { Invoice } from './invoice.service';
import type {
  VerifactuDesgloseIVA,
  VerifactuEstado,
  VerifactuIDFactura,
  VerifactuRegistro,
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
    if (!company.nif) throw new Error('La empresa no tiene NIF configurado');

    const [year, month, day] = invoice.issueDate.split('-');
    const fechaAeat = `${day}-${month}-${year}`; // dd-mm-yyyy

    const idFactura: VerifactuIDFactura = {
      NIF: company.nif,
      NumSerieFactura: invoice.invoiceNumber,
      FechaExpedicionFactura: fechaAeat,
    };

    // Desglose: una línea por tipo impositivo aplicado
    const desglose: VerifactuDesgloseIVA[] = [];
    if (invoice.vat > 0 && invoice.amount > 0) {
      const tipoImpositivo = invoice.amount > 0 ? Math.round((invoice.vat / invoice.amount) * 100) : 21;
      desglose.push({
        BaseImponibleOImporteNoSujeto: invoice.amount,
        TipoImpositivo: tipoImpositivo,
        CuotaRepercutida: invoice.vat,
      });
    } else {
      // Operación exenta / sin IVA
      desglose.push({
        BaseImponibleOImporteNoSujeto: invoice.amount,
        TipoImpositivo: 0,
        CuotaRepercutida: 0,
      });
    }

    const now = new Date().toISOString();

    return {
      IDFactura: idFactura,
      NombreRazonEmisor: company.name,
      TipoFactura: 'F1',
      DescripcionOperacion: 'Servicios profesionales',
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
    const q = query(
      collection(this.firestore, 'invoices'),
      where('companyId', '==', companyId),
      where('verifactu.estado', '==', 'enviado'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
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
    const huella = await this.computeHash(registro);
    const qrUrl = this.generateQrUrl(registro);

    const estadoInicial: VerifactuEstado = {
      estado: 'pendiente',
      huella,
      huellaAnterior,
      qrUrl,
    };

    return { registro, estadoInicial };
  }
}
