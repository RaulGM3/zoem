import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Users, Search, Plus, Phone, Mail, Building2,
  Eye, Edit, Trash2, ChevronRight, UserPlus, TrendingUp,
  GitMerge, Shield, Brain, ArrowRight,
} from 'lucide-angular';
import { CONTACTS, PIPELINE_DEALS } from '../../data/dummy-data';

type ContactosTab = 'contactos' | 'pipeline' | 'rgpd' | 'herramientas';

const RGPD_CONSENTIMIENTOS = [
  { id: 'CON-001', nombre: 'Innovatech Industries', marketing: true, perfilado: true, terceros: false },
  { id: 'CON-002', nombre: 'María García López', marketing: true, perfilado: false, terceros: false },
  { id: 'CON-003', nombre: 'Consultora Global S.L.', marketing: true, perfilado: true, terceros: true },
  { id: 'CON-004', nombre: 'StartUp Ventures S.L.', marketing: false, perfilado: false, terceros: false },
  { id: 'CON-005', nombre: 'Carlos Rodríguez', marketing: false, perfilado: false, terceros: false },
];

@Component({
  selector: 'app-contactos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, DecimalPipe],
  templateUrl: './contactos.html',
})
export class ContactosComponent {
  readonly UsersIcon = Users;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly PhoneIcon = Phone;
  readonly MailIcon = Mail;
  readonly Building2Icon = Building2;
  readonly EyeIcon = Eye;
  readonly EditIcon = Edit;
  readonly Trash2Icon = Trash2;
  readonly ChevronRightIcon = ChevronRight;
  readonly UserPlusIcon = UserPlus;
  readonly TrendingUpIcon = TrendingUp;
  readonly GitMergeIcon = GitMerge;
  readonly ShieldIcon = Shield;
  readonly BrainIcon = Brain;
  readonly ArrowRightIcon = ArrowRight;

  activeTab = signal<ContactosTab>('contactos');
  search = signal('');
  filterStatus = signal('');
  filterType = signal('');

  contacts = CONTACTS;
  pipelineDeals = PIPELINE_DEALS;
  rgpdData = RGPD_CONSENTIMIENTOS;

  etapasPipeline: Array<{ key: string; label: string }> = [
    { key: 'Lead', label: 'Lead' },
    { key: 'Calificado', label: 'Calificado' },
    { key: 'Propuesta', label: 'Propuesta' },
    { key: 'Negociación', label: 'Negociación' },
    { key: 'Ganado', label: 'Ganado' },
  ];

  dealsByEtapa = computed(() => {
    const result: Record<string, typeof this.pipelineDeals> = {};
    for (const etapa of this.etapasPipeline) {
      result[etapa.key] = this.pipelineDeals.filter(d => d.etapa === etapa.key);
    }
    return result;
  });

  totalPipeline = computed(() => this.pipelineDeals.reduce((s, d) => s + d.importe, 0));
  ganados = computed(() => this.pipelineDeals.filter(d => d.etapa === 'Ganado'));
  totalGanado = computed(() => this.ganados().reduce((s, d) => s + d.importe, 0));

  conMarketing = computed(() => this.rgpdData.filter(r => r.marketing).length);
  conPerfilado = computed(() => this.rgpdData.filter(r => r.perfilado).length);

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.filterStatus();
    const t = this.filterType();
    return this.contacts.filter((c) => {
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
      const matchS = !s || c.status === s;
      const matchT = !t || c.type === t;
      return matchQ && matchS && matchT;
    });
  });

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Activo: 'bg-green-100 text-green-700',
      Inactivo: 'bg-slate-100 text-slate-500',
      Potencial: 'bg-violet-100 text-violet-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getTypeClass(type: string): string {
    const map: Record<string, string> = {
      Empresa: 'bg-blue-100 text-blue-700',
      Persona: 'bg-amber-100 text-amber-700',
      'Autónomo': 'bg-emerald-100 text-emerald-700',
    };
    return map[type] || 'bg-slate-100 text-slate-600';
  }

  getInitials(name: string): string {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  totalBilled(): number {
    return this.contacts.reduce((sum, c) => sum + c.totalBilled, 0);
  }

  activeCount(): number {
    return this.contacts.filter((c) => c.status === 'Activo').length;
  }
}
