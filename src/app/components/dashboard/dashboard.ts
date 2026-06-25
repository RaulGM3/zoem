import {
  Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  LucideAngularModule, type LucideIconData,
  Euro, Briefcase, Bot, Wallet, Calendar, Activity, Landmark,
  Receipt, FileText, Users,
} from 'lucide-angular';

import { PermissionService } from '../../core/services/permission.service';
import { IaContactService } from '../../core/services/ia-contact.service';
import { CasosService } from '../../core/services/casos.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { CuentasService } from '../../core/services/cuentas.service';
import { EventosService } from '../../core/services/eventos.service';
import { ActividadService } from '../../core/services/actividad.service';
import { balancePorCuenta } from '../../core/tesoreria/saldos';

import type { Caso, Evento, Hito, MovimientoTipo } from '../../interfaces';
import { EVENTO_COLORS } from '../../interfaces/evento.interface';
import type { Actividad } from '../../interfaces/actividad';
import type { Modulo } from '../../core/permissions/permissions';

import { StatCardComponent } from './components/stat-card/stat-card';
import { BarChartComponent, type BarGroup } from './components/bar-chart/bar-chart';
import { DonutChartComponent, type DonutItem } from './components/donut-chart/donut-chart';

/** Estados que cuentan como "caso activo" en el dashboard. */
const ESTADOS_ACTIVOS: ReadonlySet<Caso['estado']> = new Set(['pendiente', 'en_proceso', 'urgente']);

/** Estados de un lead IA que ya NO está pendiente de atención. */
const IA_CERRADOS: ReadonlySet<string> = new Set(['resuelto', 'descartado', 'cerrado']);

const TIPO_LABEL: Record<MovimientoTipo, string> = {
  ingreso: 'Ingresos', honorario: 'Honorarios', suplido: 'Suplidos', gasto: 'Gastos', otro: 'Otros',
};
const TIPO_COLOR: Record<MovimientoTipo, string> = {
  ingreso: '#10b981', honorario: '#8b5cf6', suplido: '#3b82f6', gasto: '#ef4444', otro: '#94a3b8',
};
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const MODULO_ICON: Record<Modulo, LucideIconData> = {
  Casos: Briefcase, Contactos: Users, Calendario: Calendar, Documentos: FileText,
  Facturación: Receipt, Tesorería: Wallet, RecepciónIA: Bot, Informes: Activity, Configuración: Users,
};

export interface AgendaItem {
  id: string;
  tipo: 'evento' | 'hito';
  titulo: string;
  subtitulo: string;
  fecha: string;
  hora?: string;
  dotClass: string;
  link: string;
}

export interface MovimientoVista {
  id: string;
  fecha: string;
  concepto: string;
  importe: number;
  esEntrada: boolean;
  casoNombre: string;
  link: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DecimalPipe, LucideAngularModule, StatCardComponent, BarChartComponent, DonutChartComponent],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly perm = inject(PermissionService);
  private readonly iaContactService = inject(IaContactService);
  private readonly casosService = inject(CasosService);
  private readonly gestoriaService = inject(GestoriaService);
  private readonly cuentasService = inject(CuentasService);
  private readonly eventosService = inject(EventosService);
  private readonly actividadService = inject(ActividadService);

  private readonly subs = new Subscription();

  // ── Iconos ────────────────────────────────────────────────────────────
  readonly EuroIcon = Euro;
  readonly BriefcaseIcon = Briefcase;
  readonly BotIcon = Bot;
  readonly WalletIcon = Wallet;
  readonly LandmarkIcon = Landmark;

  // ── Fuentes de datos ──────────────────────────────────────────────────
  private readonly casos = this.casosService.casos;
  private readonly movimientos = this.gestoriaService.todosMovimientos;
  private readonly cuentas = this.cuentasService.cuentas;
  private readonly iaContacts = this.iaContactService.iaContacts;
  private readonly eventos = signal<Evento[]>([]);
  private readonly hitos = signal<Hito[]>([]);
  readonly actividades = signal<Actividad[]>([]);

  /** 'YYYY-MM' del mes en curso. */
  private readonly mesActual = new Date().toISOString().slice(0, 7);
  /** Etiqueta legible del mes en curso, p. ej. "junio 2026". */
  readonly mesActualLabel = `${MES_LARGO[new Date().getMonth()]} ${new Date().getFullYear()}`;
  /** 'YYYY-MM-DD' de hoy. */
  private readonly hoy = new Date().toISOString().slice(0, 10);

  private readonly casoNombres = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.casos()) map.set(c.id, c.titulo);
    return map;
  });

  // ── (1) Recepción IA ──────────────────────────────────────────────────
  readonly iaPendientes = computed(() =>
    this.iaContacts()
      .filter(c => !c.status || !IA_CERRADOS.has(c.status))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  );
  readonly iaPendientesCount = computed(() => this.iaPendientes().length);
  readonly iaTop = computed(() => this.iaPendientes().slice(0, 5));

  // ── (2) Ingresos del mes (honorarios) ─────────────────────────────────
  readonly ingresosMes = computed(() =>
    this.movimientos()
      .filter(m => m.esEntrada && m.fecha.slice(0, 7) === this.mesActual)
      .reduce((acc, m) => acc + m.importe, 0)
  );

  // ── (3) Casos activos ─────────────────────────────────────────────────
  readonly casosActivos = computed(() => this.casos().filter(c => ESTADOS_ACTIVOS.has(c.estado)));
  readonly casosActivosCount = computed(() => this.casosActivos().length);

  // ── (4) Saldos por cuenta (helper compartido con Tesorería) ───────────
  readonly balancesPorCuenta = computed(() =>
    balancePorCuenta(this.cuentas().filter(c => c.activa), this.movimientos())
  );
  /** Monto disponible total = suma de saldos confirmados (aprobados). */
  readonly disponibleTotal = computed(() =>
    this.balancesPorCuenta().reduce((acc, b) => acc + b.proyeccion, 0)
  );

  // ── (5) Últimos movimientos ───────────────────────────────────────────
  readonly ultimosMovimientos = computed<MovimientoVista[]>(() => {
    const nombres = this.casoNombres();
    return this.movimientos().slice(0, 8).map(m => ({
      id: m.id,
      fecha: m.fecha,
      concepto: m.concepto,
      importe: m.importe,
      esEntrada: m.esEntrada,
      casoNombre: nombres.get(m.casoId) ?? '—',
      link: `/casos/${m.casoId}`,
    }));
  });

  // ── (6) Agenda próxima (eventos + hitos) ──────────────────────────────
  readonly agendaProxima = computed<AgendaItem[]>(() => {
    const items: AgendaItem[] = [];

    for (const e of this.eventos()) {
      if (!e.fecha || e.fecha < this.hoy || e.estado === 'cancelado') continue;
      items.push({
        id: `e-${e.id}`,
        tipo: 'evento',
        titulo: e.titulo,
        subtitulo: e.lugar || (e.todoDia ? 'Todo el día' : 'Evento'),
        fecha: e.fecha,
        hora: e.todoDia ? undefined : e.horaInicio,
        dotClass: EVENTO_COLORS[e.color]?.dot ?? 'bg-slate-400',
        link: '/calendario',
      });
    }

    for (const h of this.hitos()) {
      if (!h.fechaEstimada || h.fechaEstimada < this.hoy || h.estado === 'cancelado' || h.estado === 'completado') continue;
      items.push({
        id: `h-${h.id}`,
        tipo: 'hito',
        titulo: h.titulo,
        subtitulo: h.casoTitulo,
        fecha: h.fechaEstimada,
        hora: h.horaAgenda,
        dotClass: 'bg-violet-500',
        link: `/casos/${h.casoId}`,
      });
    }

    const seen = new Set<string>();
    const unique = items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return unique
      .sort((a, b) =>
        a.fecha === b.fecha
          ? (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99')
          : a.fecha.localeCompare(b.fecha)
      )
      .slice(0, 7);
  });

  // ── (7) Estadística financiera ────────────────────────────────────────
  private readonly ultimosMeses = computed(() => {
    const base = new Date();
    const meses: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      // Use local year/month directly — toISOString() converts to UTC and shifts
      // months in timezones ahead of UTC (e.g. UTC+2 → Jan 1 00:00 → Dec 31 UTC).
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      meses.push({ key, label: MES_CORTO[d.getMonth()] });
    }
    return meses;
  });

  readonly honorariosPorMes = computed<BarGroup[]>(() =>
    this.ultimosMeses().map(({ key, label }) => ({
      label,
      bars: [{
        value: this.movimientos()
          .filter(m => m.tipo === 'honorario' && m.fecha.slice(0, 7) === key)
          .reduce((acc, m) => acc + m.importe, 0),
        color: '#8b5cf6',
        name: 'Honorarios',
      }],
    }))
  );

  readonly ingresosVsEgresosPorMes = computed<BarGroup[]>(() =>
    this.ultimosMeses().map(({ key, label }) => {
      const delMes = this.movimientos().filter(m => m.fecha.slice(0, 7) === key);
      return {
        label,
        bars: [
          { value: delMes.filter(m => m.esEntrada).reduce((a, m) => a + m.importe, 0), color: '#10b981', name: 'Ingresos' },
          { value: delMes.filter(m => !m.esEntrada).reduce((a, m) => a + m.importe, 0), color: '#ef4444', name: 'Egresos' },
        ],
      };
    })
  );

  readonly distribucionPorTipo = computed<DonutItem[]>(() => {
    const porTipo = new Map<MovimientoTipo, number>();
    for (const m of this.movimientos()) {
      porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + m.importe);
    }
    return (Object.keys(TIPO_LABEL) as MovimientoTipo[]).map(t => ({
      label: TIPO_LABEL[t],
      value: porTipo.get(t) ?? 0,
      color: TIPO_COLOR[t],
    }));
  });

  // ── Feed de actividad ─────────────────────────────────────────────────
  actividadIcon(modulo: Modulo): LucideIconData {
    return MODULO_ICON[modulo] ?? Activity;
  }

  /** 'YYYY-MM-DD' → '19 Jun'. */
  formatFecha(f: string): string {
    if (!f || f.length < 10) return f;
    return `${f.slice(8, 10)} ${MES_CORTO[Number(f.slice(5, 7)) - 1] ?? ''}`;
  }

  /** Timestamp de Firestore → '19 Jun 16:40' (vacío si aún no hay valor). */
  fechaActividad(a: Actividad): string {
    const d = a.createdAt?.toDate?.();
    if (!d) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MES_CORTO[d.getMonth()]} ${hh}:${mm}`;
  }

  async ngOnInit(): Promise<void> {
    this.gestoriaService.loadTodosMovimientos();
    this.cuentasService.loadCuentas();
    void this.casosService.loadCasos();
    void this.iaContactService.loadIaContacts();
    this.subs.add(this.eventosService.eventosStream().subscribe(e => this.eventos.set(e)));
    this.subs.add(this.casosService.hitosParaCalendarioStream().subscribe(h => this.hitos.set(h)));
    this.subs.add(this.actividadService.recentStream(15).subscribe(a => this.actividades.set(a)));
  }

  ngOnDestroy(): void {
    this.gestoriaService.stopTodosMovimientos();
    this.cuentasService.stopCuentas();
    this.subs.unsubscribe();
  }
}
