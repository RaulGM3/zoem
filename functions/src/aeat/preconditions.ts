import { calcularDesglose, esLineaExenta, MAX_DESGLOSE } from './desglose';
import { impuestoDeEmpresa } from './config';
import type { CompanyDoc, InvoiceDoc } from './types';

export type CodigoPrecondicion =
  | 'NIF_CLIENTE'
  | 'CAUSA_EXENCION'
  | 'IMPUESTO_NO_SOPORTADO'
  | 'R1_SIN_ORIGINAL'
  | 'NIF_EMISOR'
  | 'MAX_DESGLOSE'
  | 'ALTA_NO_ACEPTADA';

export type ResultadoPrecondicion = { ok: true } | { ok: false; codigo: CodigoPrecondicion; mensaje: string };

function falla(codigo: CodigoPrecondicion, mensaje: string): ResultadoPrecondicion {
  return { ok: false, codigo, mensaje };
}

function vacio(valor: string | undefined): boolean {
  return !valor || valor.trim() === '';
}

/**
 * Comprueba todo lo que debe cumplirse ANTES de generar un registro. Si falla, no se
 * envía nada ni se toca la cadena. `original` es la factura rectificada ya resuelta
 * por el llamador (solo para R1).
 */
export function validarPrecondiciones(
  invoice: InvoiceDoc,
  company: CompanyDoc,
  tipo: 'alta' | 'anulacion',
  original?: InvoiceDoc,
): ResultadoPrecondicion {
  if (vacio(company.cif)) {
    return falla('NIF_EMISOR', 'La empresa no tiene CIF/NIF configurado; es obligatorio para Verifactu.');
  }

  // La anulación solo identifica la factura: no lleva desglose ni destinatario.
  if (tipo === 'anulacion') return { ok: true };

  const impuesto = impuestoDeEmpresa(company.ca);
  if (!impuesto.ok) {
    return falla('IMPUESTO_NO_SOPORTADO', `${impuesto.motivo}. No se envía la factura a AEAT.`);
  }

  if (vacio(invoice.clienteNif)) {
    return falla('NIF_CLIENTE', 'El cliente no tiene NIF. Indica el NIF del cliente para enviar la factura a AEAT.');
  }

  if (invoice.tipoFactura === 'R1' && (!original || original.companyId !== invoice.companyId)) {
    return falla(
      'R1_SIN_ORIGINAL',
      'No se encuentra la factura original que rectifica esta factura (debe ser de la misma empresa).',
    );
  }

  const lineas = invoice.lineas ?? [];
  const ivaGlobal = invoice.ivaRate ?? 0;
  const sinCausa = lineas.find((l) => esLineaExenta(l, ivaGlobal) && !l.causaExencion);
  if (sinCausa) {
    return falla(
      'CAUSA_EXENCION',
      `La línea "${sinCausa.concepto}" está exenta o no sujeta y no tiene causa de exención. Selecciona la causa en la factura.`,
    );
  }

  const { detalles } = calcularDesglose(lineas, ivaGlobal, impuesto.impuesto);
  if (detalles.length > MAX_DESGLOSE) {
    return falla(
      'MAX_DESGLOSE',
      `La factura tiene ${detalles.length} tipos/causas distintos y AEAT admite como máximo ${MAX_DESGLOSE}.`,
    );
  }

  return { ok: true };
}
