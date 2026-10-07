import * as logger from 'firebase-functions/logger';
import type { NotifyParams } from '../notificaciones/notify';
import type { CapaAnio } from './dominio/dias-rojos';
import { aniosDelPlazo, cambioConfirmados, revisarPlazo, textoRevision, type RevisionPlazo } from './revision';
import type { PlazoDoc } from './tipos';

export interface DepsDiasRojos {
  /** Plazos `vigente` que usan la capa (ca o partido), sin duplicados. */
  plazosDeCapa(cid: string, capaId: string): Promise<PlazoDoc[]>;
  cargarCapa(cid: string, capaId: string, anio: number): Promise<CapaAnio | undefined>;
  /** Escribe SOLO `origen.estadoPlazo='requiere_revision'` y `origen.revision`. */
  marcarRevision(cid: string, eventoId: string, revision: RevisionPlazo): Promise<void>;
  destinatarios(cid: string): Promise<string[]>;
  notify(params: NotifyParams): Promise<void>;
  ahoraIso(): string;
}

export interface CambioCapa {
  cid: string;
  capaId: string;
  anio: number;
  before?: CapaAnio;
  after?: CapaAnio;
}

/** Reacciona al cambio de días rojos confirmados: marca los plazos afectados y avisa. Nunca toca fecha ni aceptación. */
export async function procesarDiasRojos(deps: DepsDiasRojos, c: CambioCapa): Promise<{ revisados: number; marcados: number }> {
  if (!cambioConfirmados(c.before, c.after)) return { revisados: 0, marcados: 0 };

  const candidatos = (await deps.plazosDeCapa(c.cid, c.capaId)).filter((p) => aniosDelPlazo(p.origen).includes(c.anio));
  const cache = new Map<string, Promise<CapaAnio | undefined>>();
  const cargar = (capaId: string, anio: number): Promise<CapaAnio | undefined> => {
    const clave = `${capaId}/${anio}`;
    let p = cache.get(clave);
    if (!p) {
      p = deps.cargarCapa(c.cid, capaId, anio);
      cache.set(clave, p);
    }
    return p;
  };

  let marcados = 0;
  let destinatarios: string[] | undefined;
  for (const plazo of candidatos) {
    try {
      const capas = new Map<string, CapaAnio | undefined>();
      for (const capaId of [plazo.origen.capas.ca, plazo.origen.capas.partido]) {
        if (!capaId) continue;
        for (const anio of aniosDelPlazo(plazo.origen)) capas.set(`${capaId}/${anio}`, await cargar(capaId, anio));
      }
      const revision = revisarPlazo(plazo.origen, (capaId, anio) => capas.get(`${capaId}/${anio}`), deps.ahoraIso());
      if (!revision) continue;

      await deps.marcarRevision(c.cid, plazo.id, revision);
      marcados++;

      destinatarios ??= await deps.destinatarios(c.cid);
      if (destinatarios.length === 0) continue;
      const { titulo, cuerpo } = textoRevision(plazo.titulo, revision);
      await deps.notify({
        companyId: c.cid,
        userIds: destinatarios,
        tipo: 'plazo',
        titulo,
        cuerpo,
        route: `/casos/${plazo.origen.casoId}`,
      });
    } catch (err) {
      logger.error('procesarDiasRojos: fallo revisando plazo', { cid: c.cid, eventoId: plazo.id, err });
    }
  }
  return { revisados: candidatos.length, marcados };
}
