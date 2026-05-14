import { Component, input, computed, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, ArrowLeft, Edit, Phone, Mail, MapPin,
  Building2, Calendar, FileText, Receipt, MessageSquare, Tag,
  ChevronRight, User,
} from 'lucide-angular';
import { CONTACTS, PROJECTS, INVOICES, DOCUMENTS } from '../../data/dummy-data';

type ContactoTab = 'general' | 'proyectos' | 'facturas' | 'comunicaciones' | 'documentos';

const HISTORIAL_COMUNICACION = [
  { id: 'C-001', tipo: 'llamada', descripcion: 'Llamada de seguimiento semanal', fecha: 'Hoy, 10:30' },
  { id: 'C-002', tipo: 'email', descripcion: 'Propuesta enviada por email', fecha: 'Ayer, 14:00' },
  { id: 'C-003', tipo: 'reunion', descripcion: 'Reunión presencial en oficinas', fecha: 'Hace 1 semana' },
];

@Component({
  selector: 'app-contacto-detail',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './contacto-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactoDetailComponent {
  readonly ArrowLeftIcon = ArrowLeft;
  readonly EditIcon = Edit;
  readonly PhoneIcon = Phone;
  readonly MailIcon = Mail;
  readonly MapPinIcon = MapPin;
  readonly Building2Icon = Building2;
  readonly CalendarIcon = Calendar;
  readonly FileTextIcon = FileText;
  readonly ReceiptIcon = Receipt;
  readonly MessageSquareIcon = MessageSquare;
  readonly TagIcon = Tag;
  readonly ChevronRightIcon = ChevronRight;
  readonly UserIcon = User;

  id = input.required<string>();

  private router = inject(Router);

  activeTab = signal<ContactoTab>('general');

  contacto = computed(() => CONTACTS.find(c => c.id === this.id()) ?? null);

  proyectos = computed(() =>
    PROJECTS.filter(p => p.client === (this.contacto()?.name ?? ''))
  );

  facturas = computed(() =>
    INVOICES.filter(f => f.client === (this.contacto()?.name ?? ''))
  );

  documentos = computed(() =>
    DOCUMENTS.filter(d => d.client === (this.contacto()?.name ?? ''))
  );

  historialComunicacion = HISTORIAL_COMUNICACION;

  historialFacturacion = [
    { mes: 'Ene', valor: 4200 },
    { mes: 'Feb', valor: 6800 },
    { mes: 'Mar', valor: 5100 },
    { mes: 'Abr', valor: 9200 },
    { mes: 'May', valor: 8400 },
  ];

  maxFactura = Math.max(...[4200, 6800, 5100, 9200, 8400]);

  barHeight(valor: number): string {
    return Math.round((valor / this.maxFactura) * 100) + '%';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Activo: 'bg-green-100 text-green-700',
      Potencial: 'bg-blue-100 text-blue-700',
      Inactivo: 'bg-slate-100 text-slate-500',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getProjectStatusClass(status: string): string {
    const map: Record<string, string> = {
      'En curso': 'bg-blue-100 text-blue-700',
      Pendiente: 'bg-amber-100 text-amber-700',
      Completado: 'bg-green-100 text-green-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getInvoiceStatusClass(status: string): string {
    const map: Record<string, string> = {
      pagada: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      vencida: 'bg-red-100 text-red-700',
      borrador: 'bg-slate-100 text-slate-500',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getComunicacionIcon(tipo: string): string {
    return tipo === 'llamada' ? '📞' : tipo === 'email' ? '✉️' : '🤝';
  }

  volver() {
    this.router.navigate(['/contactos']);
  }
}
