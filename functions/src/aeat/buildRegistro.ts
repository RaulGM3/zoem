import { ID_VERSION, SISTEMA_INFORMATICO, impuestoDeEmpresa, numeroInstalacion } from './config';
import { calcularDesglose } from './desglose';
import { fechaAeat, fechaHoraHuso } from './fechas';
import { huellaAlta, huellaAnulacion } from './huella';
import { normalizarNif } from './nif';
import type {
  ChainLink,
  CompanyDoc,
  Encadenamiento,
  IdFactura,
  InvoiceDoc,
  RegistroAlta,
  RegistroAnulacion,
  SistemaInformaticoRegistro,
} from './types';

const MAX_DESCRIPCION = 500;

export interface EntradaRegistro {
  invoice: InvoiceDoc;
  company: CompanyDoc;
  /** Eslabón anterior de la cadena (último registro GENERADO); null -> PrimerRegistro. */
  anterior: ChainLink | null;
  ahora: Date;
  /** true cuando es el reenvío corregido de un registro rechazado (Incorrecto). */
  rechazoPrevio: boolean;
}

export interface EntradaRegistroAlta extends EntradaRegistro {
  /** Factura rectificada ya resuelta (solo R1). */
  original?: InvoiceDoc;
}

function idFacturaDe(invoice: InvoiceDoc, company: CompanyDoc): IdFactura {
  return {
    idEmisor: company.cif ?? '',
    numSerie: invoice.invoiceNumber,
    fecha: fechaAeat(invoice.issueDate),
  };
}

function encadenamientoDe(anterior: ChainLink | null): Encadenamiento {
  return anterior ? { primerRegistro: false, anterior } : { primerRegistro: true };
}

function sistemaInformaticoDe(companyId: string): SistemaInformaticoRegistro {
  return { ...SISTEMA_INFORMATICO, numeroInstalacion: numeroInstalacion(companyId) };
}

/** DescripcionOperacion: obligatoria, no vacía, máx. 500. Sale de los conceptos de las líneas. */
function descripcionDe(invoice: InvoiceDoc): string {
  const conceptos = (invoice.lineas ?? []).map((l) => l.concepto.trim()).filter((c) => c !== '');
  const texto = conceptos.length > 0 ? conceptos.join(', ') : `Factura ${invoice.invoiceNumber}`;
  return texto.slice(0, MAX_DESCRIPCION);
}

export function buildRegistroAlta(entrada: EntradaRegistroAlta): RegistroAlta {
  const { invoice, company, original, anterior, ahora, rechazoPrevio } = entrada;

  const impuesto = impuestoDeEmpresa(company.ca);
  if (!impuesto.ok) throw new Error(impuesto.motivo);

  const tipoFactura = invoice.tipoFactura ?? 'F1';
  if (tipoFactura === 'R1' && !original) {
    throw new Error('Una factura rectificativa R1 necesita la factura original');
  }

  const idFactura = idFacturaDe(invoice, company);
  const { detalles, cuotaTotal, importeTotal } = calcularDesglose(invoice.lineas ?? [], invoice.ivaRate ?? 0, impuesto.impuesto);
  const fechaHora = fechaHoraHuso(ahora);

  const registro: RegistroAlta = {
    tipo: 'alta',
    idVersion: ID_VERSION,
    idFactura,
    nombreRazonEmisor: company.name,
    tipoFactura,
    descripcionOperacion: descripcionDe(invoice),
    desglose: detalles,
    cuotaTotal,
    importeTotal,
    encadenamiento: encadenamientoDe(anterior),
    sistemaInformatico: sistemaInformaticoDe(invoice.companyId),
    fechaHoraHusoGenRegistro: fechaHora,
    tipoHuella: '01',
    huella: huellaAlta({
      idEmisor: idFactura.idEmisor,
      numSerie: idFactura.numSerie,
      fecha: idFactura.fecha,
      tipoFactura,
      cuotaTotal,
      importeTotal,
      huellaAnterior: anterior?.huella ?? '',
      fechaHoraHuso: fechaHora,
    }),
  };

  if (rechazoPrevio) {
    registro.subsanacion = 'S';
    registro.rechazoPrevio = 'X';
  }
  if (tipoFactura === 'R1' && original) {
    registro.tipoRectificativa = 'I';
    registro.facturasRectificadas = [idFacturaDe(original, company)];
  }
  if (invoice.clienteNif) {
    registro.destinatario = { nombreRazon: invoice.clienteNombre ?? '', nif: normalizarNif(invoice.clienteNif) };
  }
  return registro;
}

export function buildRegistroAnulacion(entrada: EntradaRegistro): RegistroAnulacion {
  const { invoice, company, anterior, ahora, rechazoPrevio } = entrada;
  const idFactura = idFacturaDe(invoice, company);
  const fechaHora = fechaHoraHuso(ahora);

  const registro: RegistroAnulacion = {
    tipo: 'anulacion',
    idVersion: ID_VERSION,
    idFactura,
    encadenamiento: encadenamientoDe(anterior),
    sistemaInformatico: sistemaInformaticoDe(invoice.companyId),
    fechaHoraHusoGenRegistro: fechaHora,
    tipoHuella: '01',
    huella: huellaAnulacion({
      idEmisor: idFactura.idEmisor,
      numSerie: idFactura.numSerie,
      fecha: idFactura.fecha,
      huellaAnterior: anterior?.huella ?? '',
      fechaHoraHuso: fechaHora,
    }),
  };
  if (rechazoPrevio) registro.rechazoPrevio = 'S';
  return registro;
}
