import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideAngularModule, Send, Mail, MessageSquare, Phone, Bell,
  Plus, Search, ToggleLeft, ToggleRight, Clock, CheckCheck, Users,
} from 'lucide-angular';
import {
  CONVERSACIONES, CAMPANAS, PLANTILLAS_MENSAJE,
  type Conversacion,
} from '../../data/dummy-data';

type ComunicacionesTab = 'bandeja' | 'campanas' | 'plantillas' | 'automatizaciones' | 'historial';

const AUTOMATIZACIONES = [
  { id: 'A-001', nombre: 'Bienvenida nuevo cliente', trigger: 'Nuevo contacto creado', canal: 'email', activo: true },
  { id: 'A-002', nombre: 'Recordatorio factura vencida', trigger: 'Factura vencida +3 días', canal: 'sms', activo: true },
  { id: 'A-003', nombre: 'Seguimiento propuesta', trigger: '7 días sin respuesta', canal: 'whatsapp', activo: false },
  { id: 'A-004', nombre: 'Felicitación cumpleaños', trigger: 'Fecha de nacimiento', canal: 'email', activo: true },
];

const HISTORIAL = [
  { id: 'H-001', destinatario: 'María García López', canal: 'email', asunto: 'Propuesta de servicios', estado: 'abierto', fecha: 'Hoy, 10:00' },
  { id: 'H-002', destinatario: 'Innovatech Industries', canal: 'email', asunto: 'Newsletter Mayo 2026', estado: 'entregado', fecha: 'Ayer, 09:00' },
  { id: 'H-003', destinatario: 'StartUp Ventures', canal: 'sms', asunto: 'Recordatorio pago', estado: 'entregado', fecha: 'Hace 2 días' },
  { id: 'H-004', destinatario: 'Carlos Rodríguez', canal: 'whatsapp', asunto: 'Seguimiento reunión', estado: 'respondido', fecha: 'Hace 3 días' },
];

@Component({
  selector: 'app-comunicaciones',
  imports: [LucideAngularModule],
  templateUrl: './comunicaciones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComunicacionesComponent {
  readonly SendIcon = Send;
  readonly MailIcon = Mail;
  readonly MessageSquareIcon = MessageSquare;
  readonly PhoneIcon = Phone;
  readonly BellIcon = Bell;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly ToggleLeftIcon = ToggleLeft;
  readonly ToggleRightIcon = ToggleRight;
  readonly ClockIcon = Clock;
  readonly CheckCheckIcon = CheckCheck;
  readonly UsersIcon = Users;

  activeTab = signal<ComunicacionesTab>('bandeja');
  selectedConv = signal<Conversacion | null>(CONVERSACIONES[0]);

  conversaciones = CONVERSACIONES;
  campanas = CAMPANAS;
  plantillas = PLANTILLAS_MENSAJE;
  automatizaciones = AUTOMATIZACIONES;
  historial = HISTORIAL;

  totalNoLeidos = computed(() => this.conversaciones.reduce((s, c) => s + c.noLeidos, 0));

  stats = [
    { label: 'Emails este mes', value: '234', icon: 'mail' },
    { label: 'WhatsApp este mes', value: '87', icon: 'whatsapp' },
    { label: 'SMS este mes', value: '43', icon: 'sms' },
    { label: 'Automatizaciones', value: '4', icon: 'automatizaciones' },
  ];

  getCanalClass(canal: string): string {
    const map: Record<string, string> = {
      email: 'bg-blue-100 text-blue-700',
      whatsapp: 'bg-green-100 text-green-700',
      sms: 'bg-amber-100 text-amber-700',
    };
    return map[canal] || 'bg-slate-100 text-slate-600';
  }

  getCampanaEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      enviada: 'bg-green-100 text-green-700',
      borrador: 'bg-slate-100 text-slate-600',
      programada: 'bg-blue-100 text-blue-700',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getHistorialEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      abierto: 'bg-blue-100 text-blue-700',
      entregado: 'bg-green-100 text-green-700',
      respondido: 'bg-violet-100 text-violet-700',
      rebotado: 'bg-red-100 text-red-700',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }
}
