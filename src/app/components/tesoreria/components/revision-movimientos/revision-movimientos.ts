import {
  Component, ChangeDetectionStrategy, input, inject, signal, computed, OnInit, OnDestroy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule,
  ClipboardCheck, CheckCircle2, Circle, CheckCheck, Pencil, X,
} from 'lucide-angular';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CasosService } from '../../../../core/services/casos.service';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { UsersService } from '../../../../core/services/users';
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
  private readonly toast = inject(ToastService);
  private readonly cuentasService = inject(CuentasService);
  private readonly usersService = inject(UsersService);

  readonly ClipboardCheckIcon = ClipboardCheck;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleIcon = Circle;
  readonly CheckCheckIcon = CheckCheck;
  readonly PencilIcon = Pencil;
  readonly XIcon = X;

  readonly conciliado = input<boolean>(false);
  readonly hoveringAprobacion = signal<string | null>(null);

  readonly cuentas = this.cuentasService.cuentas;

  readonly loading = this.gestoriaService.todosLoading;
  readonly aprobandoTodos = signal(false);
  readonly toggling = signal<string | null>(null);
  readonly editandoMovId = signal<string | null>(null);
  readonly cambiandoCuenta = signal(false);

  readonly filtro = signal<Filtro>('pendientes');

  private readonly movimientos = this.gestoriaService.todosMovimientos;

  private readonly casoNombres = computed(() => {
    const mapa = new Map<string, string>();
    for (const c of this.casosService.casos()) mapa.set(c.id, c.titulo);
    return mapa;
  });

  private readonly cuentaNombres = computed(() => {
    const mapa = new Map<string, string>();
    for (const c of this.cuentasService.cuentas()) mapa.set(c.id, c.nombre);
    return mapa;
  });

  private readonly miembrosMap = computed(() =>
    new Map(this.usersService.members().map(m => [m.userId, m.nombre]))
  );

  readonly movimientosEnriquecidos = computed(() => {
    const nombres = this.casoNombres();
    const cuentas = this.cuentaNombres();
    const miembros = this.miembrosMap();
    return this.movimientos().map(m => ({
      ...m,
      casoNombre: (m.casoId ? (nombres.get(m.casoId) ?? m.casoId) : 'General'),
      cuentaNombre: m.cuentaId ? (cuentas.get(m.cuentaId) ?? null) : null,
      creadoPorNombre: miembros.get(m.createdBy) ?? null,
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
    if (this.usersService.members().length === 0) {
      this.usersService.loadMembers();
    }
  }

  ngOnDestroy(): void {
    this.gestoriaService.stopTodosMovimientos();
  }

  async toggleAprobado(mov: MovimientoGestoria): Promise<void> {
    this.toggling.set(mov.id);
    try {
      await this.toast.run(() => this.gestoriaService.aprobarMovimiento(mov.casoId, mov.id, !mov.aprobado), {
        errorTitle: 'No se pudo cambiar la aprobación',
      });
    } finally {
      this.toggling.set(null);
    }
  }

  async cambiarCuenta(mov: MovimientoGestoria, cuentaId: string): Promise<void> {
    const nuevoId = cuentaId || null;
    if (nuevoId === (mov.cuentaId ?? null)) {
      this.editandoMovId.set(null);
      return;
    }
    this.cambiandoCuenta.set(true);
    try {
      await this.toast.run(() => this.gestoriaService.cambiarCuenta(mov.casoId, mov.id, nuevoId), {
        errorTitle: 'No se pudo cambiar la cuenta',
      });
    } finally {
      this.cambiandoCuenta.set(false);
      this.editandoMovId.set(null);
    }
  }

  async aprobarTodos(): Promise<void> {
    this.aprobandoTodos.set(true);
    try {
      await this.toast.run(() => this.gestoriaService.aprobarTodos(this.pendientes()), {
        successMessage: 'Movimientos aprobados',
        errorTitle: 'No se pudieron aprobar los movimientos',
      });
    } finally {
      this.aprobandoTodos.set(false);
    }
  }

  tipoLabel(tipo: MovimientoTipo): string {
    const labels: Record<MovimientoTipo, string> = {
      ingreso: 'Ingreso', suplido: 'Suplido', honorario: 'Honorario',
      gasto: 'Gasto', otro: 'Otro', ajuste: 'Ajuste',
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
      ajuste: 'bg-slate-100 text-slate-600',
    };
    return map[tipo] ?? 'bg-slate-100 text-slate-600';
  }
}
