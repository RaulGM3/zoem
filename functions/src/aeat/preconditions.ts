import { calcularDesglose, esLineaExenta, MAX_DESGLOSE } from './desglose';
import { impuestoDeEmpresa } from './config';
import { normalizarNif, validarNif } from './nif';
import type { CompanyDoc, InvoiceDoc } from './types';

export type CodigoPrecondicion =
  | 'NIF_CLIENTE'
  | 'NIF_CLIENTE_INVALIDO'
  | 'CLIENTE_EXTRANJERO'
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

function validarAltaAceptada(invoice: InvoiceDoc): ResultadoPrecondicion {
  const estado = invoice.verifactu?.estado;
  if (estado === 'enviado') return { ok: true };
  if (estado === 'pendiente' || estado === 'en_cola') {
    return falla(
      'ALTA_NO_ACEPTADA',
      'El alta de esta factura aún está en curso; podrás anularla en Verifactu cuando la AEAT la acepte.',
    );
  }
  return falla('ALTA_NO_ACEPTADA', 'La factura no llegó a registrarse en la AEAT: no hay nada que anular en Verifactu.');
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

  // La anulación solo identifica la factura: no lleva desglose ni destinatario. Pero solo
  // tiene sentido anular lo que AEAT tiene registrado (alta `enviado`, también con errores
  // admisibles). La anulación sin registro previo (`SinRegistroPrevio`) queda fuera de alcance.
  if (tipo === 'anulacion') return validarAltaAceptada(invoice);

  const impuesto = impuestoDeEmpresa(company.ca);
  if (!impuesto.ok) {
    return falla('IMPUESTO_NO_SOPORTADO', `${impuesto.motivo}. No se envía la factura a AEAT.`);
  }

  if (invoice.clienteTipoId === 'extranjero') {
    return falla(
      'CLIENTE_EXTRANJERO',
      'El cliente se identifica con un documento extranjero (pasaporte, VAT u otro). Zoem aún no envía a la AEAT facturas con documentos extranjeros: la factura no se ha registrado en Verifactu.',
    );
  }

  if (vacio(invoice.clienteNif)) {
    return falla('NIF_CLIENTE', 'El cliente no tiene NIF. Indica el NIF del cliente para enviar la factura a AEAT.');
  }

  if (!validarNif(invoice.clienteNif ?? '').ok) {
    return falla(
      'NIF_CLIENTE_INVALIDO',
      `El NIF del cliente «${normalizarNif(invoice.clienteNif ?? '')}» no es un NIF español válido. Corrígelo en la factura y vuelve a enviarla.`,
    );
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
