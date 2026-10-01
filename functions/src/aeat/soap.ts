import type { ChainLink, DetalleDesglose, Encadenamiento, IdFactura, Registro, RegistroAlta, RegistroAnulacion, SistemaInformaticoRegistro } from './types';

// Construcción del sobre SOAP de alta/anulación (SuministroLR + SuministroInformacion).
// Prefijos: sfLR solo en RegFactuSistemaFacturacion, Cabecera y RegistroFactura; todo lo
// demás va en sf (elementFormDefault=qualified). Orden de hijos = secuencia del XSD.
// Salida compacta (sin espacios entre elementos) para que el XML guardado sea determinista.

const NS_SOAPENV = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_BASE = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws';
const NS_SF_LR = `${NS_BASE}/SuministroLR.xsd`;
const NS_SF = `${NS_BASE}/SuministroInformacion.xsd`;

export interface ObligadoEmision {
  nombreRazon: string;
  nif: string;
}

export function escapeXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Elemento sf con texto escapado. */
function sf(nombre: string, valor: string): string {
  return `<sf:${nombre}>${escapeXml(valor)}</sf:${nombre}>`;
}

function sfContenedor(nombre: string, ...hijos: (string | undefined)[]): string {
  return `<sf:${nombre}>${hijos.filter((h): h is string => h !== undefined).join('')}</sf:${nombre}>`;
}

function idFacturaAlta(id: IdFactura): string[] {
  return [sf('IDEmisorFactura', id.idEmisor), sf('NumSerieFactura', id.numSerie), sf('FechaExpedicionFactura', id.fecha)];
}

function detalle(d: DetalleDesglose): string {
  return sfContenedor(
    'DetalleDesglose',
    sf('Impuesto', d.impuesto),
    sf('ClaveRegimen', d.claveRegimen),
    d.calificacionOperacion ? sf('CalificacionOperacion', d.calificacionOperacion) : undefined,
    d.operacionExenta ? sf('OperacionExenta', d.operacionExenta) : undefined,
    d.tipoImpositivo !== undefined ? sf('TipoImpositivo', d.tipoImpositivo) : undefined,
    sf('BaseImponibleOimporteNoSujeto', d.baseImponible),
    d.cuotaRepercutida !== undefined ? sf('CuotaRepercutida', d.cuotaRepercutida) : undefined,
  );
}

function encadenamiento(e: Encadenamiento): string {
  if (e.primerRegistro) return sfContenedor('Encadenamiento', sf('PrimerRegistro', 'S'));
  const a: ChainLink = e.anterior;
  return sfContenedor(
    'Encadenamiento',
    sfContenedor('RegistroAnterior', ...idFacturaAlta(a), sf('Huella', a.huella)),
  );
}

function sistemaInformatico(s: SistemaInformaticoRegistro): string {
  return sfContenedor(
    'SistemaInformatico',
    sf('NombreRazon', s.nombreRazon),
    sf('NIF', s.nif),
    sf('NombreSistemaInformatico', s.nombreSistemaInformatico),
    sf('IdSistemaInformatico', s.idSistemaInformatico),
    sf('Version', s.version),
    sf('NumeroInstalacion', s.numeroInstalacion),
    sf('TipoUsoPosibleSoloVerifactu', s.tipoUsoPosibleSoloVerifactu),
    sf('TipoUsoPosibleMultiOT', s.tipoUsoPosibleMultiOT),
    sf('IndicadorMultiplesOT', s.indicadorMultiplesOT),
  );
}

function registroAlta(r: RegistroAlta): string {
  return sfContenedor(
    'RegistroAlta',
    sf('IDVersion', r.idVersion),
    sfContenedor('IDFactura', ...idFacturaAlta(r.idFactura)),
    sf('NombreRazonEmisor', r.nombreRazonEmisor),
    r.subsanacion ? sf('Subsanacion', r.subsanacion) : undefined,
    r.rechazoPrevio ? sf('RechazoPrevio', r.rechazoPrevio) : undefined,
    sf('TipoFactura', r.tipoFactura),
    r.tipoRectificativa ? sf('TipoRectificativa', r.tipoRectificativa) : undefined,
    r.facturasRectificadas
      ? sfContenedor(
          'FacturasRectificadas',
          ...r.facturasRectificadas.map((f) => sfContenedor('IDFacturaRectificada', ...idFacturaAlta(f))),
        )
      : undefined,
    sf('DescripcionOperacion', r.descripcionOperacion),
    r.destinatario
      ? sfContenedor(
          'Destinatarios',
          sfContenedor('IDDestinatario', sf('NombreRazon', r.destinatario.nombreRazon), sf('NIF', r.destinatario.nif)),
        )
      : undefined,
    sfContenedor('Desglose', ...r.desglose.map(detalle)),
    sf('CuotaTotal', r.cuotaTotal),
    sf('ImporteTotal', r.importeTotal),
    encadenamiento(r.encadenamiento),
    sistemaInformatico(r.sistemaInformatico),
    sf('FechaHoraHusoGenRegistro', r.fechaHoraHusoGenRegistro),
    sf('TipoHuella', r.tipoHuella),
    sf('Huella', r.huella),
  );
}

function registroAnulacion(r: RegistroAnulacion): string {
  return sfContenedor(
    'RegistroAnulacion',
    sf('IDVersion', r.idVersion),
    sfContenedor(
      'IDFactura',
      sf('IDEmisorFacturaAnulada', r.idFactura.idEmisor),
      sf('NumSerieFacturaAnulada', r.idFactura.numSerie),
      sf('FechaExpedicionFacturaAnulada', r.idFactura.fecha),
    ),
    r.rechazoPrevio ? sf('RechazoPrevio', r.rechazoPrevio) : undefined,
    encadenamiento(r.encadenamiento),
    sistemaInformatico(r.sistemaInformatico),
    sf('FechaHoraHusoGenRegistro', r.fechaHoraHusoGenRegistro),
    sf('TipoHuella', r.tipoHuella),
    sf('Huella', r.huella),
  );
}

/** Sobre SOAP completo para un registro (un registro por envío). */
export function buildEnvelope(obligado: ObligadoEmision, registro: Registro): string {
  const cuerpoRegistro = registro.tipo === 'alta' ? registroAlta(registro) : registroAnulacion(registro);
  return (
    `<soapenv:Envelope xmlns:soapenv="${NS_SOAPENV}" xmlns:sfLR="${NS_SF_LR}" xmlns:sf="${NS_SF}">` +
    '<soapenv:Header/>' +
    '<soapenv:Body>' +
    '<sfLR:RegFactuSistemaFacturacion>' +
    '<sfLR:Cabecera>' +
    sfContenedor('ObligadoEmision', sf('NombreRazon', obligado.nombreRazon), sf('NIF', obligado.nif)) +
    '</sfLR:Cabecera>' +
    `<sfLR:RegistroFactura>${cuerpoRegistro}</sfLR:RegistroFactura>` +
    '</sfLR:RegFactuSistemaFacturacion>' +
    '</soapenv:Body>' +
    '</soapenv:Envelope>'
  );
}
