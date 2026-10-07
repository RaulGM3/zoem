import { inject, Injectable } from '@angular/core';
import { collection, collectionData, doc, Firestore, getDoc, query, where } from '@angular/fire/firestore';
import type { Observable } from 'rxjs';
import type { CreateEventoData, Evento, OrigenPlazoProcesal } from '../../interfaces/evento.interface';
import { calcularVencimiento } from '../plazos/computo-plazo';
import type { ResultadoPlazo } from '../plazos/computo-plazo';
import { componerDiasRojos } from '../plazos/dias-rojos';
import type { DiaRojo } from '../plazos/dias-rojos';
import { aniosAfectados } from '../plazos/edicion-capa';
import type { CapasResueltas } from '../plazos/edicion-capa';
import { construirEventoPlazo, construirOrigenPlazo, formatearFechaEs } from '../plazos/plazo-evento';
import type { EntradaPlazoGuardada } from '../plazos/plazo-evento';
import { anioDe } from '../plazos/fechas-iso';
import { CalendariosJudicialesService } from './calendarios-judiciales.service';
import { CompanyService } from './company.service';
import { EventosService } from './eventos.service';
import { UserSyncService } from './user-sync.service';

export interface EntradaPrevisualizacion extends EntradaPlazoGuardada {
  caso: { id: string; titulo?: string; partidoJudicialId?: string };
  /** Días que el usuario desmarcó en la revisión: se tratan como hábiles. */
  excluidosPorUsuario?: readonly string[];
}

export interface Previsualizacion {
  resultado: ResultadoPlazo;
  /** Capas usadas, para guardarlas en el plazo aceptado. */
  capas: CapasResueltas;
  /** URL oficial (BOE/BOCM…) por fecha, de los días rojos que la tienen. */
  fuentes: Readonly<Record<string, string>>;
  /** Avisos legibles: del cómputo, sin partido judicial y años sin calendario confirmado. */
  advertencias: string[];
}

export interface EntradaGuardarPlazo extends EntradaPlazoGuardada {
  etiqueta: string;
  casoTitulo?: string;
  capas: { ca: string; partido?: string };
  invitados?: CreateEventoData['invitados'];
  documentoId?: string;
}

const AVISO_SIN_PARTIDO =
  'El caso no tiene partido judicial: solo se aplican los festivos de la comunidad autónoma de la empresa, no los locales.';

const MAX_PASADAS_ANIOS = 5;

/**
 * Cálculo y persistencia de plazos procesales (BETA). El plazo se guarda como un Evento
 * cuyo `origen` congela lo que el usuario revisó y aceptó; nada cambia en silencio después.
 */
@Injectable({ providedIn: 'root' })
export class PlazosService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly userSync = inject(UserSyncService);
  private readonly calendarios = inject(CalendariosJudicialesService);
  private readonly eventos = inject(EventosService);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get uid(): string {
    const id = this.userSync.currentUser()?.id;
    if (!id) throw new Error('No current user');
    return id;
  }

  async previsualizar(input: EntradaPrevisualizacion): Promise<Previsualizacion> {
    const ca = this.companyService.activeCompany()?.ca;
    if (!ca) throw new Error('La empresa no tiene comunidad autónoma configurada');

    let anios = [anioDe(input.fechaNotificacion)];
    for (let pasada = 0; ; pasada++) {
      const cargado = await this.calendarios.capasDelCalculo(input.caso, ca, anios);
      const diasRojos = new Map<string, DiaRojo>();
      const aniosConCalendario: number[] = [];
      for (const anio of anios) {
        const capa = cargado.porAnio.get(anio);
        const compuesto = componerDiasRojos(capa?.ca, capa?.partido);
        if (compuesto.size > 0) aniosConCalendario.push(anio);
        compuesto.forEach((d, f) => diasRojos.set(f, d));
      }
      const resultado = calcularVencimiento({
        fechaNotificacion: input.fechaNotificacion,
        cantidad: input.cantidad,
        unidad: input.unidad,
        jurisdiccion: input.jurisdiccion,
        urgente: input.urgente,
        diasRojos,
        excluidosPorUsuario: input.excluidosPorUsuario,
        aniosConCalendario,
      });
      const necesarios = aniosAfectados(input.fechaNotificacion, resultado.diaGracia);
      if (necesarios.every((a) => anios.includes(a)) || pasada >= MAX_PASADAS_ANIOS) {
        const advertencias = [
          ...(cargado.advertencias.includes('sin_partido') ? [AVISO_SIN_PARTIDO] : []),
          ...resultado.advertencias,
        ];
        const fuentes: Record<string, string> = {};
        diasRojos.forEach((d, f) => {
          if (d.fuenteUrl) fuentes[f] = d.fuenteUrl;
        });
        return { resultado: { ...resultado, advertencias }, capas: cargado.capas, fuentes, advertencias };
      }
      anios = necesarios;
    }
  }

  /** Persiste el plazo aceptado como Evento ligado al caso. */
  guardar(
    casoId: string,
    entrada: EntradaGuardarPlazo,
    resultadoAceptado: ResultadoPlazo,
    excluidos: readonly string[],
  ): Promise<Evento> {
    const { etiqueta, casoTitulo, capas, invitados, documentoId, ...datosEntrada } = entrada;
    return this.eventos.createEvento(
      construirEventoPlazo({
        casoId, casoTitulo, etiqueta, entrada: datosEntrada, capas, resultado: resultadoAceptado,
        excluidosPorUsuario: excluidos, uid: this.uid, ahoraIso: new Date().toISOString(), invitados, documentoId,
      }),
    );
  }

  /** El usuario revisa y acepta el nuevo vencimiento tras un cambio de días rojos. */
  async aceptarRevision(eventoId: string, nuevoResultado: ResultadoPlazo, excluidos?: readonly string[]): Promise<void> {
    const { evento, origen } = await this.cargarPlazo(eventoId);
    const nuevo = construirOrigenPlazo({
      casoId: origen.casoId,
      etiqueta: '',
      entrada: origen.entrada,
      capas: origen.capas,
      resultado: nuevoResultado,
      excluidosPorUsuario: excluidos ?? origen.aceptacion.excluidosPorUsuario,
      uid: this.uid,
      ahoraIso: new Date().toISOString(),
      documentoId: origen.documentoId,
    });
    await this.eventos.updateEvento(eventoId, {
      fecha: nuevoResultado.vencimiento,
      descripcion: `${evento.descripcion ?? ''}${evento.descripcion ? '\n' : ''}Revisado y aceptado: vence el ${formatearFechaEs(nuevoResultado.vencimiento)} (día de gracia ${formatearFechaEs(nuevoResultado.diaGracia)}, hasta las 15:00).`,
      origen: nuevo,
    });
  }

  async marcarCumplido(eventoId: string): Promise<void> {
    const { origen } = await this.cargarPlazo(eventoId);
    const cumplido: OrigenPlazoProcesal = { ...origen, estadoPlazo: 'cumplido' };
    delete cumplido.revision;
    await this.eventos.updateEvento(eventoId, { estado: 'completado', origen: cumplido });
  }

  /** Plazos del caso en tiempo real (filtros de igualdad: no requieren índice compuesto). */
  plazosDelCaso(casoId: string): Observable<Evento[]> {
    const q = query(
      collection(this.firestore, 'companies', this.companyId, 'eventos'),
      where('origen.tipo', '==', 'plazo_procesal'),
      where('origen.casoId', '==', casoId),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Evento[]>;
  }

  private async cargarPlazo(eventoId: string): Promise<{ evento: Evento; origen: OrigenPlazoProcesal }> {
    const snap = await getDoc(doc(this.firestore, 'companies', this.companyId, 'eventos', eventoId));
    const evento = snap.exists() ? ({ id: snap.id, ...snap.data() } as Evento) : undefined;
    if (evento?.origen?.tipo !== 'plazo_procesal') throw new Error('El evento no es un plazo procesal');
    return { evento, origen: evento.origen };
  }
}
