import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { buildEnvelope, escapeXml } from './soap';
import { buildRegistroAlta, buildRegistroAnulacion } from './buildRegistro';
import type { ChainLink, CompanyDoc, InvoiceDoc, InvoiceLineaDoc, Registro } from './types';

interface Nodo {
  nombre: string;
  texto?: string;
  hijos: Nodo[];
}

/** Árbol con prefijos y orden de hijos preservados. */
function arbol(xml: string): Nodo {
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: true, parseTagValue: false, trimValues: true });
  const convertir = (items: Record<string, unknown>[]): Nodo[] =>
    items
      .filter((it) => !('#text' in it) || Object.keys(it).length > 1)
      .map((it) => {
        const nombre = Object.keys(it).find((k) => k !== ':@')!;
        const contenido = it[nombre] as Record<string, unknown>[];
        const soloTexto = contenido.length === 1 && '#text' in contenido[0];
        return {
          nombre,
          texto: soloTexto ? String(contenido[0]['#text']) : undefined,
          hijos: soloTexto ? [] : convertir(contenido),
        };
      });
  const parsed = parser.parse(xml) as Record<string, unknown>[];
  const raiz = convertir(parsed.filter((n) => !('?xml' in n)));
  return raiz[0];
}

function hijo(n: Nodo, nombre: string): Nodo {
  const h = n.hijos.find((x) => x.nombre === nombre);
  if (!h) throw new Error(`No hay <${nombre}> dentro de <${n.nombre}>: ${n.hijos.map((x) => x.nombre).join(',')}`);
  return h;
}

function nombres(n: Nodo): string[] {
  return n.hijos.map((h) => h.nombre);
}

function linea(over: Partial<InvoiceLineaDoc> = {}): InvoiceLineaDoc {
  return { concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true, ivaRate: 0.21, ...over };
}
function factura(over: Partial<InvoiceDoc> = {}): InvoiceDoc {
  return {
    id: 'inv1', companyId: 'co1', invoiceNumber: 'F-2026-001', total: 121, issueDate: '2026-03-15',
    clienteNombre: 'Cliente SL', clienteNif: 'B12345674', lineas: [linea()], ivaRate: 0.21, tipoFactura: 'F1', ...over,
  };
}
function empresa(over: Partial<CompanyDoc> = {}): CompanyDoc {
  return { name: 'Despacho SL', cif: 'B76543210', ca: 'madrid', verifactu: { enabled: true, sandbox: true }, ...over };
}
const AHORA = new Date('2026-03-15T10:20:30Z');
const ANTERIOR: ChainLink = {
  idEmisor: 'B76543210', numSerie: 'F-2026-000', fecha: '14-03-2026', huella: 'A'.repeat(64), fechaHoraHuso: '2026-03-14T09:00:00+01:00',
};
const OBLIGADO = { nombreRazon: 'Despacho SL', nif: 'B76543210' };

function alta(over: Partial<InvoiceDoc> = {}, anterior: ChainLink | null = null, extra: { rechazoPrevio?: boolean; original?: InvoiceDoc; company?: CompanyDoc } = {}): Registro {
  return buildRegistroAlta({
    invoice: factura(over), company: extra.company ?? empresa(), original: extra.original, anterior, ahora: AHORA, rechazoPrevio: extra.rechazoPrevio ?? false,
  });
}

const NS_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd';
const NS_SF = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';

describe('escapeXml', () => {
  it('S4.5 escapa & < > " \'', () => {
    expect(escapeXml('A&B <S.L.>')).toBe('A&amp;B &lt;S.L.&gt;');
    expect(escapeXml(`"hola" y 'adiós'`)).toBe('&quot;hola&quot; y &apos;adiós&apos;');
  });
  it('no toca texto sin caracteres especiales', () => {
    expect(escapeXml('Despacho 123')).toBe('Despacho 123');
  });
});

describe('buildEnvelope alta', () => {
  it('S4.1 declara las dos namespaces con las URLs literales y es XML bien formado', () => {
    const xml = buildEnvelope(OBLIGADO, alta());
    expect(xml).toContain(`xmlns:sfLR="${NS_LR}"`);
    expect(xml).toContain(`xmlns:sf="${NS_SF}"`);
    expect(xml).toContain('xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"');
    expect(() => arbol(xml)).not.toThrow();
  });

  it('SOAP: Envelope > Header + Body > RegFactuSistemaFacturacion', () => {
    const raiz = arbol(buildEnvelope(OBLIGADO, alta()));
    expect(raiz.nombre).toBe('soapenv:Envelope');
    expect(nombres(raiz)).toEqual(['soapenv:Header', 'soapenv:Body']);
    expect(nombres(hijo(raiz, 'soapenv:Body'))).toEqual(['sfLR:RegFactuSistemaFacturacion']);
  });

  it('R4.2 Cabecera (sfLR) con ObligadoEmision (sf) y RegistroFactura (sfLR) > RegistroAlta (sf)', () => {
    const reg = hijo(hijo(arbol(buildEnvelope(OBLIGADO, alta())), 'soapenv:Body'), 'sfLR:RegFactuSistemaFacturacion');
    expect(nombres(reg)).toEqual(['sfLR:Cabecera', 'sfLR:RegistroFactura']);
    const obligado = hijo(hijo(reg, 'sfLR:Cabecera'), 'sf:ObligadoEmision');
    expect(nombres(obligado)).toEqual(['sf:NombreRazon', 'sf:NIF']);
    expect(hijo(obligado, 'sf:NombreRazon').texto).toBe('Despacho SL');
    expect(hijo(obligado, 'sf:NIF').texto).toBe('B76543210');
    expect(nombres(hijo(reg, 'sfLR:RegistroFactura'))).toEqual(['sf:RegistroAlta']);
  });

  function registroAlta(xml: string): Nodo {
    const reg = hijo(hijo(arbol(xml), 'soapenv:Body'), 'sfLR:RegFactuSistemaFacturacion');
    return hijo(hijo(reg, 'sfLR:RegistroFactura'), 'sf:RegistroAlta');
  }

  it('S4.2 orden de los hijos de RegistroAlta según el XSD (primer registro, F1)', () => {
    const n = registroAlta(buildEnvelope(OBLIGADO, alta()));
    expect(nombres(n)).toEqual([
      'sf:IDVersion', 'sf:IDFactura', 'sf:NombreRazonEmisor', 'sf:TipoFactura', 'sf:DescripcionOperacion',
      'sf:Destinatarios', 'sf:Desglose', 'sf:CuotaTotal', 'sf:ImporteTotal', 'sf:Encadenamiento',
      'sf:SistemaInformatico', 'sf:FechaHoraHusoGenRegistro', 'sf:TipoHuella', 'sf:Huella',
    ]);
    expect(nombres(hijo(n, 'sf:IDFactura'))).toEqual(['sf:IDEmisorFactura', 'sf:NumSerieFactura', 'sf:FechaExpedicionFactura']);
    expect(hijo(n, 'sf:IDVersion').texto).toBe('1.0');
  });

  it('Destinatarios > IDDestinatario > NombreRazon, NIF', () => {
    const n = registroAlta(buildEnvelope(OBLIGADO, alta()));
    const dest = hijo(hijo(n, 'sf:Destinatarios'), 'sf:IDDestinatario');
    expect(nombres(dest)).toEqual(['sf:NombreRazon', 'sf:NIF']);
    expect(hijo(dest, 'sf:NIF').texto).toBe('B12345674');
  });

  it('DetalleDesglose gravado: Impuesto, ClaveRegimen, CalificacionOperacion, TipoImpositivo, BaseImponibleOimporteNoSujeto, CuotaRepercutida', () => {
    const n = registroAlta(buildEnvelope(OBLIGADO, alta()));
    const det = hijo(hijo(n, 'sf:Desglose'), 'sf:DetalleDesglose');
    expect(nombres(det)).toEqual([
      'sf:Impuesto', 'sf:ClaveRegimen', 'sf:CalificacionOperacion', 'sf:TipoImpositivo', 'sf:BaseImponibleOimporteNoSujeto', 'sf:CuotaRepercutida',
    ]);
    expect(hijo(det, 'sf:Impuesto').texto).toBe('01');
    expect(hijo(det, 'sf:ClaveRegimen').texto).toBe('01');
    expect(hijo(det, 'sf:CalificacionOperacion').texto).toBe('S1');
    expect(hijo(det, 'sf:TipoImpositivo').texto).toBe('21.00');
    expect(hijo(det, 'sf:BaseImponibleOimporteNoSujeto').texto).toBe('100.00');
    expect(hijo(det, 'sf:CuotaRepercutida').texto).toBe('21.00');
  });

  it('DetalleDesglose exento: OperacionExenta, sin TipoImpositivo ni Cuota; no sujeta: CalificacionOperacion N1', () => {
    const n = registroAlta(
      buildEnvelope(OBLIGADO, alta({ lineas: [linea({ aplicaIva: false, causaExencion: 'E1' }), linea({ aplicaIva: false, causaExencion: 'N1' })] })),
    );
    const dets = hijo(n, 'sf:Desglose').hijos;
    expect(nombres(dets[0])).toEqual(['sf:Impuesto', 'sf:ClaveRegimen', 'sf:OperacionExenta', 'sf:BaseImponibleOimporteNoSujeto']);
    expect(hijo(dets[0], 'sf:OperacionExenta').texto).toBe('E1');
    expect(nombres(dets[1])).toEqual(['sf:Impuesto', 'sf:ClaveRegimen', 'sf:CalificacionOperacion', 'sf:BaseImponibleOimporteNoSujeto']);
    expect(hijo(dets[1], 'sf:CalificacionOperacion').texto).toBe('N1');
  });

  it('S4.3 SistemaInformatico: 9 hijos en orden XSD', () => {
    const n = registroAlta(buildEnvelope(OBLIGADO, alta()));
    const si = hijo(n, 'sf:SistemaInformatico');
    expect(nombres(si)).toEqual([
      'sf:NombreRazon', 'sf:NIF', 'sf:NombreSistemaInformatico', 'sf:IdSistemaInformatico', 'sf:Version', 'sf:NumeroInstalacion',
      'sf:TipoUsoPosibleSoloVerifactu', 'sf:TipoUsoPosibleMultiOT', 'sf:IndicadorMultiplesOT',
    ]);
    expect(hijo(si, 'sf:NumeroInstalacion').texto).toBe('ZOEM-co1');
  });

  it('TipoHuella=01 y Huella del registro', () => {
    const reg = alta();
    const n = registroAlta(buildEnvelope(OBLIGADO, reg));
    expect(hijo(n, 'sf:TipoHuella').texto).toBe('01');
    expect(hijo(n, 'sf:Huella').texto).toBe(reg.huella);
  });

  it('S4.8 no añade ds:Signature (VERI*FACTU)', () => {
    const xml = buildEnvelope(OBLIGADO, alta());
    expect(xml).not.toContain('Signature');
    expect(xml).not.toContain('xmlns:ds');
  });

  it('S4.5 el texto interpolado va escapado y el XML sigue siendo válido', () => {
    const xml = buildEnvelope({ nombreRazon: 'A&B <S.L.>', nif: 'B76543210' }, alta({ clienteNombre: 'Pérez & "Hijos"' }, null, { company: empresa({ name: 'A&B <S.L.>' }) }));
    expect(xml).toContain('A&amp;B &lt;S.L.&gt;');
    expect(xml).not.toContain('A&B <S.L.>');
    expect(() => arbol(xml)).not.toThrow();
    const n = registroAlta(xml);
    // el parser decodifica entidades: la ida y vuelta devuelve el texto original
    expect(hijo(n, 'sf:NombreRazonEmisor').texto).toBe('A&B <S.L.>');
  });
});

describe('buildEnvelope Encadenamiento y flags', () => {
  function registroAlta(xml: string): Nodo {
    const reg = hijo(hijo(arbol(xml), 'soapenv:Body'), 'sfLR:RegFactuSistemaFacturacion');
    return hijo(hijo(reg, 'sfLR:RegistroFactura'), 'sf:RegistroAlta');
  }

  it('S4.4 primer registro -> PrimerRegistro=S sin RegistroAnterior', () => {
    const enc = hijo(registroAlta(buildEnvelope(OBLIGADO, alta())), 'sf:Encadenamiento');
    expect(nombres(enc)).toEqual(['sf:PrimerRegistro']);
    expect(hijo(enc, 'sf:PrimerRegistro').texto).toBe('S');
  });

  it('S4.4 segundo registro -> RegistroAnterior con 4 campos del anterior', () => {
    const enc = hijo(registroAlta(buildEnvelope(OBLIGADO, alta({}, ANTERIOR))), 'sf:Encadenamiento');
    expect(nombres(enc)).toEqual(['sf:RegistroAnterior']);
    const ant = hijo(enc, 'sf:RegistroAnterior');
    expect(nombres(ant)).toEqual(['sf:IDEmisorFactura', 'sf:NumSerieFactura', 'sf:FechaExpedicionFactura', 'sf:Huella']);
    expect(hijo(ant, 'sf:IDEmisorFactura').texto).toBe('B76543210');
    expect(hijo(ant, 'sf:NumSerieFactura').texto).toBe('F-2026-000');
    expect(hijo(ant, 'sf:FechaExpedicionFactura').texto).toBe('14-03-2026');
    expect(hijo(ant, 'sf:Huella').texto).toBe('A'.repeat(64));
  });

  it('alta por rechazo: Subsanacion y RechazoPrevio justo tras NombreRazonEmisor', () => {
    const n = registroAlta(buildEnvelope(OBLIGADO, alta({}, ANTERIOR, { rechazoPrevio: true })));
    expect(nombres(n).slice(0, 6)).toEqual(['sf:IDVersion', 'sf:IDFactura', 'sf:NombreRazonEmisor', 'sf:Subsanacion', 'sf:RechazoPrevio', 'sf:TipoFactura']);
    expect(hijo(n, 'sf:Subsanacion').texto).toBe('S');
    expect(hijo(n, 'sf:RechazoPrevio').texto).toBe('X');
  });

  it('R1: TipoRectificativa=I y FacturasRectificadas/IDFacturaRectificada tras TipoFactura', () => {
    const original = factura({ id: 'orig', invoiceNumber: 'F-2026-000', issueDate: '2026-02-01' });
    const n = registroAlta(buildEnvelope(OBLIGADO, alta({ tipoFactura: 'R1' }, null, { original })));
    expect(nombres(n).slice(3, 7)).toEqual(['sf:TipoFactura', 'sf:TipoRectificativa', 'sf:FacturasRectificadas', 'sf:DescripcionOperacion']);
    expect(hijo(n, 'sf:TipoRectificativa').texto).toBe('I');
    const rect = hijo(hijo(n, 'sf:FacturasRectificadas'), 'sf:IDFacturaRectificada');
    expect(nombres(rect)).toEqual(['sf:IDEmisorFactura', 'sf:NumSerieFactura', 'sf:FechaExpedicionFactura']);
    expect(hijo(rect, 'sf:FechaExpedicionFactura').texto).toBe('01-02-2026');
  });
});

describe('buildEnvelope anulación', () => {
  function registroAnulacion(xml: string): Nodo {
    const reg = hijo(hijo(arbol(xml), 'soapenv:Body'), 'sfLR:RegFactuSistemaFacturacion');
    return hijo(hijo(reg, 'sfLR:RegistroFactura'), 'sf:RegistroAnulacion');
  }
  const anular = (rechazoPrevio = false, anterior: ChainLink | null = ANTERIOR): Registro =>
    buildRegistroAnulacion({ invoice: factura(), company: empresa(), anterior, ahora: AHORA, rechazoPrevio });

  it('S4.6/S4.7 RegistroAnulacion con campos Anulada y orden XSD; sin nombres legacy', () => {
    const xml = buildEnvelope(OBLIGADO, anular());
    expect(xml).not.toContain('RegistroBaja');
    expect(xml).not.toContain('DetalleIVA');
    expect(xml).not.toContain('RegistroAlta');
    const n = registroAnulacion(xml);
    expect(nombres(n)).toEqual([
      'sf:IDVersion', 'sf:IDFactura', 'sf:Encadenamiento', 'sf:SistemaInformatico', 'sf:FechaHoraHusoGenRegistro', 'sf:TipoHuella', 'sf:Huella',
    ]);
    expect(nombres(hijo(n, 'sf:IDFactura'))).toEqual(['sf:IDEmisorFacturaAnulada', 'sf:NumSerieFacturaAnulada', 'sf:FechaExpedicionFacturaAnulada']);
  });

  it('S4.6 RegistroAnterior usa los nombres sin "Anulada"', () => {
    const ant = hijo(hijo(registroAnulacion(buildEnvelope(OBLIGADO, anular())), 'sf:Encadenamiento'), 'sf:RegistroAnterior');
    expect(nombres(ant)).toEqual(['sf:IDEmisorFactura', 'sf:NumSerieFactura', 'sf:FechaExpedicionFactura', 'sf:Huella']);
  });

  it('S4.4 anulación como primer registro -> PrimerRegistro=S', () => {
    const enc = hijo(registroAnulacion(buildEnvelope(OBLIGADO, anular(false, null))), 'sf:Encadenamiento');
    expect(nombres(enc)).toEqual(['sf:PrimerRegistro']);
  });

  it('R7.11 reintento: RechazoPrevio=S entre IDFactura y Encadenamiento', () => {
    const n = registroAnulacion(buildEnvelope(OBLIGADO, anular(true)));
    expect(nombres(n).slice(0, 4)).toEqual(['sf:IDVersion', 'sf:IDFactura', 'sf:RechazoPrevio', 'sf:Encadenamiento']);
    expect(hijo(n, 'sf:RechazoPrevio').texto).toBe('S');
  });

  it('prefijos: RegistroFactura en sfLR y RegistroAnulacion en sf', () => {
    const reg = hijo(hijo(arbol(buildEnvelope(OBLIGADO, anular())), 'soapenv:Body'), 'sfLR:RegFactuSistemaFacturacion');
    expect(nombres(hijo(reg, 'sfLR:RegistroFactura'))).toEqual(['sf:RegistroAnulacion']);
    expect(buildEnvelope(OBLIGADO, anular())).not.toContain('Signature');
  });
});
