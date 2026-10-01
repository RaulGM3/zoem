import { XMLParser, XMLValidator } from 'fast-xml-parser';

// Interpreta la respuesta HTTP de AEAT. Se empareja por NOMBRE LOCAL (removeNSPrefix):
// los prefijos de namespace varían. Cualquier cosa no reconocida es `unknown` (fail-safe:
// nunca se considera aceptada).

export interface HttpRespuesta {
  status: number;
  body: string;
}

export interface DuplicadoInfo {
  idPeticion: string;
  estado: string;
}

export type Resultado =
  | { tipo: 'correcto'; csv?: string; esperaS?: number }
  | { tipo: 'aceptadoConErrores'; csv?: string; codigo?: string; descripcion?: string; esperaS?: number }
  | { tipo: 'incorrecto'; codigo?: string; descripcion?: string; duplicado?: DuplicadoInfo; esperaS?: number }
  | { tipo: 'fault'; faultstring: string }
  | { tipo: 'transporte'; status: number }
  | { tipo: 'unknown' };

type Nodo = Record<string, unknown>;

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function esNodo(v: unknown): v is Nodo {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Primer descendiente con ese nombre local (búsqueda en profundidad). */
function buscar(nodo: unknown, nombre: string): unknown {
  if (Array.isArray(nodo)) {
    for (const item of nodo) {
      const r = buscar(item, nombre);
      if (r !== undefined) return r;
    }
    return undefined;
  }
  if (!esNodo(nodo)) return undefined;
  if (nombre in nodo) return nodo[nombre];
  for (const valor of Object.values(nodo)) {
    const r = buscar(valor, nombre);
    if (r !== undefined) return r;
  }
  return undefined;
}

function texto(v: unknown): string | undefined {
  if (typeof v === 'string') return v === '' ? undefined : v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

function primero(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function faultstringDe(fault: unknown): string {
  if (!esNodo(fault)) return '';
  const directo = texto(fault['faultstring']);
  if (directo) return directo;
  // SOAP 1.2: Reason > Text
  const razon = texto(buscar(fault['Reason'], 'Text'));
  return razon ?? '';
}

export function parseRespuesta(http: HttpRespuesta): Resultado {
  let arbol: unknown;
  const valido = http.body.trim() !== '' && XMLValidator.validate(http.body) === true;
  if (valido) {
    try {
      arbol = parser.parse(http.body);
    } catch {
      arbol = undefined;
    }
  }

  // Un Fault manda sobre el status: AEAT responde 500 con el Fault dentro.
  const fault = buscar(arbol, 'Fault');
  if (fault !== undefined) return { tipo: 'fault', faultstring: faultstringDe(fault) };

  if (http.status < 200 || http.status >= 300) return { tipo: 'transporte', status: http.status };
  if (arbol === undefined) return { tipo: 'unknown' };

  const respuesta = buscar(arbol, 'RespuestaRegFactuSistemaFacturacion');
  if (!esNodo(respuesta)) return { tipo: 'unknown' };

  const linea = primero(respuesta['RespuestaLinea']);
  if (!esNodo(linea)) return { tipo: 'unknown' };

  const estado = texto(linea['EstadoRegistro']);
  const csv = texto(respuesta['CSV']);
  const espera = Number(texto(respuesta['TiempoEsperaEnvio']));
  const esperaS = Number.isFinite(espera) && texto(respuesta['TiempoEsperaEnvio']) !== undefined ? espera : undefined;

  // Código/descripción A NIVEL DE REGISTRO: propiedades directas de RespuestaLinea,
  // nunca las anidadas dentro de RegistroDuplicado.
  const codigo = texto(linea['CodigoErrorRegistro']);
  const descripcion = texto(linea['DescripcionErrorRegistro']);

  const conEspera = <T extends object>(r: T): T & { esperaS?: number } => (esperaS !== undefined ? { ...r, esperaS } : r);

  switch (estado) {
    case 'Correcto':
      return conEspera({ tipo: 'correcto' as const, ...(csv !== undefined && { csv }) });
    case 'AceptadoConErrores':
      return conEspera({
        tipo: 'aceptadoConErrores' as const,
        ...(csv !== undefined && { csv }),
        ...(codigo !== undefined && { codigo }),
        ...(descripcion !== undefined && { descripcion }),
      });
    case 'Incorrecto': {
      const dup = linea['RegistroDuplicado'];
      const idPeticion = esNodo(dup) ? texto(dup['IdPeticionRegistroDuplicado']) : undefined;
      const estadoDup = esNodo(dup) ? texto(dup['EstadoRegistroDuplicado']) : undefined;
      const duplicado: DuplicadoInfo | undefined = estadoDup !== undefined ? { idPeticion: idPeticion ?? '', estado: estadoDup } : undefined;
      return conEspera({
        tipo: 'incorrecto' as const,
        ...(codigo !== undefined && { codigo }),
        ...(descripcion !== undefined && { descripcion }),
        ...(duplicado && { duplicado }),
      });
    }
    default:
      return { tipo: 'unknown' };
  }
}
