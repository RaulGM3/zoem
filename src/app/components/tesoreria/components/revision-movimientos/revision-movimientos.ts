import {
  Component, ChangeDetectionStrategy, input, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule,
  ClipboardCheck, CheckCircle2, Circle, CheckCheck,
} from 'lucide-angular';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { CasosService } from '../../../../core/services/casos.service';
import { MovimientoGestoria, MovimientoTipo } from '../../../../interfaces';

type Filtro = 'todos' | 'pendientes' | 'aprobados';

@Component({
  selector: 'app-revision-movimientos',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './revision-movimientos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevisionMovimientosComponent implements OnInit, OnDestroy {
  private readonly gestoriaService = inject(GestoriaService);
  private readonly casosService = inject(CasosService);

  readonly ClipboardCheckIcon = ClipboardCheck;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleIcon = Circle;
  readonly CheckCheckIcon = CheckCheck;

  readonly conciliado = input<boolean>(false);

  readonly loading = this.gestoriaService.todosLoading;
  readonly aprobandoTodos = signal(false);
  readonly toggling = signal<string | null>(null);

  readonly filtro = signal<Filtro>('todos');

  private readonly movimientos = this.gestoriaService.todosMovimientos;

  private readonly casoNombres = computed(() => {
    const mapa = new Map<string, string>();
    for (const c of this.casosService.casos()) mapa.set(c.id, c.titulo);
    return mapa;
  });

  readonly movimientosEnriquecidos = computed(() => {
    const nombres = this.casoNombres();
    return this.movimientos().map(m => ({
      ...m,
      casoNombre: nombres.get(m.casoId) ?? m.casoId,
    }));
  });

  readonly aprobados = computed(() => this.movimientosEnriquecidos().filter(m => m.aprobado));
  readonly pendientes = computed(() => this.movimientosEnriquecidos().filter(m => !m.aprobado));

  readonly progreso = computed(() => ({
    aprobados: this.aprobados().length,
    total: this.movimientosEnriquecidos().length,
  }));

  readonly movimientosFiltrados = computed(() => {
    switch (this.filtro()) {
      case 'pendientes': return this.pendientes();
      case 'aprobados': return this.aprobados();
      default: return this.movimientosEnriquecidos();
    }
  });

  readonly puedeAprobarTodos = computed(
    () => this.conciliado() && this.pendientes().length > 0
  );

  ngOnInit(): void {
    this.gestoriaService.loadTodosMovimientos();
  }

  ngOnDestroy(): void {
    this.gestoriaService.stopTodosMovimientos();
  }

  async toggleAprobado(mov: MovimientoGestoria): Promise<void> {
    this.toggling.set(mov.id);
    try {
      await this.gestoriaService.aprobarMovimiento(mov.casoId, mov.id, !mov.aprobado);
    } finally {
      this.toggling.set(null);
    }
  }

  async aprobarTodos(): Promise<void> {
    this.aprobandoTodos.set(true);
    try {
      await this.gestoriaService.aprobarTodos(this.pendientes());
    } finally {
      this.aprobandoTodos.set(false);
    }
  }

  tipoLabel(tipo: MovimientoTipo): string {
    const labels: Record<MovimientoTipo, string> = {
      ingreso: 'Ingreso', suplido: 'Suplido', honorario: 'Honorario',
      gasto: 'Gasto', otro: 'Otro',
    };
    return labels[tipo] ?? tipo;
  }

  tipoClasses(tipo: MovimientoTipo): string {
    const map: Record<MovimientoTipo, string> = {
      ingreso: 'bg-emerald-100 text-emerald-700',
      suplido: 'bg-amber-100 text-amber-700',
      honorario: 'bg-violet-100 text-violet-700',
      gasto: 'bg-red-100 text-red-700',
      otro: 'bg-slate-100 text-slate-600',
    };
    return map[tipo] ?? 'bg-slate-100 text-slate-600';
  }
}
