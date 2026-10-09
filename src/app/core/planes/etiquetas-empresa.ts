import type { Suscripcion } from './catalogo';
import { diasRestantes, enPruebaVigente, suscripcionLegada } from './derechos';

export interface EmpresaEtiquetable {
  esDemo?: boolean;
  autoservicio?: boolean;
  plan?: string;
  suscripcion?: Suscripcion;
}

/** Plan efectivo + marcas de origen para el listado del superusuario (detectar altas en autoservicio). */
export function etiquetasEmpresa(c: EmpresaEtiquetable, ahora: Date): { plan: string; marcas: string[] } {
  const marcas: string[] = [];
  if (c.esDemo) marcas.push('Demo');
  if (c.autoservicio) marcas.push('Autoservicio');
  const s = c.suscripcion;
  if (s?.estado === 'prueba') {
    marcas.push(enPruebaVigente(s, ahora) ? `Prueba · ${diasRestantes(s.periodoFin, ahora)} d` : 'Prueba vencida');
  }
  return { plan: s ? s.plan : `${suscripcionLegada(c.plan).plan} (legada)`, marcas };
}
