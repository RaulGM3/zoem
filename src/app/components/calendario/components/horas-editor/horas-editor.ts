import { Component, ChangeDetectionStrategy, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, Clock, Trash2, Plus, Scissors } from 'lucide-angular';
import { ToastService } from '../../../../core/services/toast.service';
import type { CalendarItem } from '../../calendario.types';
import type { CompanyMember, RegistroHoraHito } from '../../../../interfaces';
import {
  DEFAULT_DURATION,
  memberName,
  minutesToTime,
  minutosAHoras,
  newRegistroId,
  timeToMinutes,
} from '../../agenda-utils';

export interface RegistrosChange {
  hitoId: string;
  casoId?: string;
  registros: RegistroHoraHito[];
}

/**
 * Sección "Horas trabajadas" del detalle de un hito (cobro por horas): resumen
 * de los registros y editor de bloques con fusión ante edición concurrente.
 */
@Component({
  selector: 'app-horas-editor',
  imports: [LucideAngularModule],
  templateUrl: './horas-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HorasEditorComponent {
  /**
   * Hito cuyas horas se editan. Debe llegar SIEMPRE fresco (derivado del stream
   * de Firestore): `saveHoras` lo usa como estado más reciente del servidor.
   */
  readonly item = input.required<CalendarItem>();
  readonly members = input<CompanyMember[]>([]);

  readonly registrosChanged = output<RegistrosChange>();

  readonly ClockIcon = Clock;
  readonly Trash2Icon = Trash2;
  readonly PlusIcon = Plus;
  readonly ScissorsIcon = Scissors;

  private readonly toast = inject(ToastService);

  /** Copia de trabajo de los registros de horas mientras el editor está abierto (null = cerrado). */
  readonly horasEditor = signal<RegistroHoraHito[] | null>(null);

  /** Total de horas de la copia de trabajo del editor. */
  readonly horasEditorTotal = computed(() => {
    const regs = this.horasEditor();
    if (!regs) return 0;
    return minutosAHoras(regs.reduce((s, r) => s + r.minutos, 0));
  });

  /**
   * Copia (por id) de los registros TAL COMO estaban al abrir el editor. No solo
   * los ids: se necesita el valor original para poder distinguir en `saveHoras`
   * si un id que ya existía fue tocado por otro usuario mientras el editor
   * estaba abierto (comparando baseline vs. estado más reciente del servidor).
   */
  private horasEditorBaseline = new Map<string, RegistroHoraHito>();

  private bloqueDefault(item: CalendarItem, fecha: string): RegistroHoraHito {
    const userId = item.asignadosA?.[0] ?? this.members()[0]?.userId ?? '';
    const horaInicio = item.horaInicio ?? '09:00';
    const fin = timeToMinutes(horaInicio) + (item.duracionMinutos ?? DEFAULT_DURATION);
    const horaFin = minutesToTime(fin);
    return {
      id: newRegistroId(),
      userId,
      fecha,
      horaInicio,
      horaFin,
      minutos: Math.max(0, fin - timeToMinutes(horaInicio)),
    };
  }

  /** Abre el editor de horas sembrando la copia de trabajo desde el hito. */
  openHorasEditor(): void {
    const item = this.item();
    const existentes = (item.registrosHoras ?? []).map(r => ({ ...r }));
    this.horasEditorBaseline = new Map(existentes.map(r => [r.id, { ...r }]));
    this.horasEditor.set(existentes.length > 0 ? existentes : [this.bloqueDefault(item, item.date)]);
  }

  /** Compara los campos relevantes de dos registros (ignora identidad de objeto). */
  private registrosEqual(a: RegistroHoraHito, b: RegistroHoraHito): boolean {
    return a.userId === b.userId
      && a.fecha === b.fecha
      && a.horaInicio === b.horaInicio
      && a.horaFin === b.horaFin
      && a.minutos === b.minutos
      && !!a.facturado === !!b.facturado
      && a.movimientoId === b.movimientoId;
  }

  cancelHorasEditor(): void {
    this.horasEditor.set(null);
  }

  addBloque(): void {
    const item = this.item();
    this.horasEditor.update(regs => regs ? [...regs, this.bloqueDefault(item, item.date)] : regs);
  }

  /** "Separar": duplica un bloque en el día siguiente para repartir el trabajo. */
  splitBloque(id: string): void {
    this.horasEditor.update(regs => {
      if (!regs) return regs;
      const src = regs.find(r => r.id === id);
      if (!src) return regs;
      const next = new Date(src.fecha + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      // Construir la fecha con componentes locales — toISOString() convierte a
      // UTC y en husos horarios positivos (p.ej. España) puede devolver el
      // mismo día original, duplicando el bloque en vez de separarlo.
      const fecha = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      return [...regs, { ...src, id: newRegistroId(), fecha }];
    });
  }

  removeBloque(id: string): void {
    this.horasEditor.update(regs => regs ? regs.filter(r => r.id !== id) : regs);
  }

  private recomputeMinutos(r: RegistroHoraHito): number {
    return Math.max(0, timeToMinutes(r.horaFin) - timeToMinutes(r.horaInicio));
  }

  updateBloqueField(id: string, field: 'fecha' | 'horaInicio' | 'horaFin' | 'userId', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.horasEditor.update(regs => {
      if (!regs) return regs;
      return regs.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value } as RegistroHoraHito;
        updated.minutos = this.recomputeMinutos(updated);
        return updated;
      });
    });
  }

  /**
   * Persiste los registros (descarta los facturados, que son inmutables, conservándolos).
   * Fusiona contra el estado MÁS RECIENTE del hito (no el snapshot al abrir el
   * editor): los segmentos que este usuario no tocó pero que un compañero pudo
   * haber añadido/editado mientras el modal estaba abierto se conservan tal
   * cual, en vez de perderse por un reemplazo ciego del array completo.
   *
   * Para los ids que YA existían al abrir el editor, no basta con saber que
   * siguen existiendo: hay que detectar si el valor vivo en el servidor
   * cambió respecto al baseline capturado al abrir (edición concurrente de un
   * compañero). Si además el usuario actual también lo modificó, es un
   * conflicto real — se prioriza la versión del servidor (last-write-wins) y
   * se avisa con un toast, en vez de pisar silenciosamente el cambio ajeno con
   * la copia local, ya obsoleta.
   */
  saveHoras(): void {
    const item = this.item();
    const regs = this.horasEditor();
    if (!regs) return;
    const limpios = regs.filter(r => r.minutos > 0 && r.userId);
    const latest = item.registrosHoras ?? [];
    const latestById = new Map(latest.map(r => [r.id, r]));
    const editedIds = new Set(limpios.map(r => r.id));

    let hayConflicto = false;
    let borradoRemoto = false;
    let borradoLocalPisoRemoto = false;

    const resueltos: RegistroHoraHito[] = limpios.flatMap(local => {
      const baseline = this.horasEditorBaseline.get(local.id);
      const actual = latestById.get(local.id);
      if (!baseline) return [local]; // nuevo: no existía al abrir el editor

      if (!actual) {
        // Existía al abrir el editor pero otro usuario lo borró en el servidor
        // mientras tanto: respetar el borrado remoto, no resucitarlo.
        borradoRemoto = true;
        return [];
      }

      const cambioRemoto = !this.registrosEqual(baseline, actual);
      if (!cambioRemoto) return [local]; // nadie más lo tocó → vale la edición local

      const cambioLocal = !this.registrosEqual(baseline, local);
      if (cambioLocal && !this.registrosEqual(actual, local)) {
        // Editado por ambos a la vez con resultados distintos: conflicto real. Gana el servidor.
        hayConflicto = true;
      }
      // Solo cambió en el servidor (o hay conflicto) → conservar la versión más reciente.
      return [actual];
    });

    // Ids que existían al abrir el editor y el usuario borró localmente (no
    // están en `limpios`): si alguien más los editó en el servidor mientras
    // tanto, se respeta el borrado local como decisión explícita del usuario,
    // pero se avisa de que se perdió una edición ajena.
    for (const [id, baseline] of this.horasEditorBaseline) {
      if (editedIds.has(id)) continue; // no fue borrado localmente
      const actual = latestById.get(id);
      if (actual && !this.registrosEqual(baseline, actual)) {
        borradoLocalPisoRemoto = true;
      }
    }

    const ajenos = latest.filter(r => !this.horasEditorBaseline.has(r.id) && !editedIds.has(r.id));

    // Los registros facturados son inmutables: sea cual sea la decisión local
    // (editar o borrar), si el servidor los tiene marcados como facturado=true
    // se conservan tal cual — sin excepción, aunque el borrado/edición local
    // no debería llegar a proponerlos porque la UI los deshabilita.
    const registrosMap = new Map([...resueltos, ...ajenos].map(r => [r.id, r]));
    for (const r of latest) {
      if (r.facturado) registrosMap.set(r.id, r);
    }
    const registros = [...registrosMap.values()];

    this.registrosChanged.emit({ hitoId: item.id, casoId: item.casoId, registros });
    if (hayConflicto) {
      this.toast.info(
        'Alguien más editó alguno de estos bloques de horas mientras los modificabas; se ha conservado su versión.',
        'Edición concurrente detectada',
      );
    }
    if (borradoRemoto) {
      this.toast.info(
        'Un bloque fue eliminado por otro usuario y no se restauró.',
        'Edición concurrente detectada',
      );
    }
    if (borradoLocalPisoRemoto) {
      this.toast.info(
        'Se eliminó un bloque que otro usuario había modificado mientras tanto.',
        'Edición concurrente detectada',
      );
    }
    this.horasEditor.set(null);
  }

  memberName(userId: string): string {
    return memberName(this.members(), userId);
  }

  bloqueHoras(r: RegistroHoraHito): number {
    return minutosAHoras(r.minutos);
  }
}
