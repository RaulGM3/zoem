import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, BarChart3, TrendingUp, TrendingDown, Users,
  Clock, RefreshCw, Download, Target,
} from 'lucide-angular';
import { PROJECTS, INVOICES, CONTACTS } from '../../data/dummy-data';

type InformesTab = 'general' | 'financiero' | 'clientes' | 'equipo';
type Periodo = 'semana' | 'mes' | 'trimestre' | 'año';

const INGRESOS_MENSUALES = [
  { mes: 'Ene', valor: 12400 },
  { mes: 'Feb', valor: 15200 },
  { mes: 'Mar', valor: 18600 },
  { mes: 'Abr', valor: 14800 },
  { mes: 'May', valor: 21300 },
];

const EQUIPO = [
  { nombre: 'Carlos Mendoza', proyectos: 8, horas: 142, eficiencia: 94 },
  { nombre: 'Ana Martínez', proyectos: 6, horas: 128, eficiencia: 88 },
  { nombre: 'Laura Sánchez', proyectos: 5, horas: 115, eficiencia: 91 },
];

@Component({
  selector: 'app-informes',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './informes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformesComponent {
  readonly BarChart3Icon = BarChart3;
  readonly TrendingUpIcon = TrendingUp;
  readonly TrendingDownIcon = TrendingDown;
  readonly UsersIcon = Users;
  readonly ClockIcon = Clock;
  readonly RefreshCwIcon = RefreshCw;
  readonly DownloadIcon = Download;
  readonly TargetIcon = Target;

  activeTab = signal<InformesTab>('general');
  periodo = signal<Periodo>('mes');

  periodos: { value: Periodo; label: string }[] = [
    { value: 'semana', label: 'Esta semana' },
    { value: 'mes', label: 'Este mes' },
    { value: 'trimestre', label: 'Trimestre' },
    { value: 'año', label: 'Este año' },
  ];

  ingresosMensuales = INGRESOS_MENSUALES;
  maxIngreso = Math.max(...INGRESOS_MENSUALES.map(i => i.valor));

  equipo = EQUIPO;

  totalIngresos = computed(() => INVOICES.filter(i => i.status === 'pagada').reduce((s, i) => s + i.total, 0));
  totalPendiente = computed(() => INVOICES.filter(i => i.status === 'pendiente').reduce((s, i) => s + i.total, 0));
  totalVencido = computed(() => INVOICES.filter(i => i.status === 'vencida').reduce((s, i) => s + i.total, 0));
  proyectosActivos = computed(() => PROJECTS.filter(p => p.status === 'En curso').length);

  topClientes = computed(() =>
    CONTACTS.slice()
      .sort((a, b) => b.totalBilled - a.totalBilled)
      .slice(0, 5)
  );

  servicios = [
    { nombre: 'Desarrollo', porcentaje: 42, color: 'bg-violet-500' },
    { nombre: 'Consultoría', porcentaje: 28, color: 'bg-blue-500' },
    { nombre: 'Diseño', porcentaje: 18, color: 'bg-emerald-500' },
    { nombre: 'Marketing', porcentaje: 12, color: 'bg-amber-500' },
  ];

  barHeight(valor: number): string {
    return Math.round((valor / this.maxIngreso) * 100) + '%';
  }
}
