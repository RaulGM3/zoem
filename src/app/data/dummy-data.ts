import type {
  Project, Contact, Invoice, CalendarEvent, IaContact, AppDocument,
  Caso, PipelineDeal, RegistroHora, Tarea, HistorialEntry,
} from '../interfaces';
export type { Project, Contact, Invoice, CalendarEvent, IaContact, AppDocument, Caso, PipelineDeal, RegistroHora, Tarea, HistorialEntry };

// --- PROJECTS ---
export const PROJECTS: Project[] = [
  {
    id: '2026-089',
    client: 'Innovatech Industries',
    type: 'Desarrollo',
    status: 'En curso',
    description: 'Plataforma web de gestión empresarial con dashboard analytics',
    openDate: '15 Mar 2026',
    lastUpdate: 'Hace 2 horas',
    nextDeadline: '30 May 2026',
    daysToDeadline: 25,
    assignedTo: 'Carlos Mendoza',
    priority: 'alta',
    progress: 65,
    budget: 25000,
    hoursLogged: 85,
  },
  {
    id: '2026-088',
    client: 'Estudio Creativo Luna',
    type: 'Diseño',
    status: 'Pendiente',
    description: 'Rediseño de identidad visual y branding completo',
    openDate: '10 Mar 2026',
    lastUpdate: 'Hace 5 horas',
    nextDeadline: '27 May 2026',
    daysToDeadline: 22,
    assignedTo: 'Ana Martínez',
    priority: 'alta',
    progress: 15,
    budget: 8500,
    hoursLogged: 12,
  },
  {
    id: '2026-087',
    client: 'Consultora Global',
    type: 'Estrategia',
    status: 'En curso',
    description: 'Plan de transformación digital y optimización de procesos',
    openDate: '5 Mar 2026',
    lastUpdate: 'Ayer',
    nextDeadline: '15 Jun 2026',
    daysToDeadline: 41,
    assignedTo: 'Carlos Mendoza',
    priority: 'media',
    progress: 45,
    budget: 15000,
    hoursLogged: 42,
  },
  {
    id: '2026-086',
    client: 'StartUp Ventures',
    type: 'Consultoría',
    status: 'En espera',
    description: 'Asesoría en modelo de negocio y estrategia de crecimiento',
    openDate: '1 Mar 2026',
    lastUpdate: 'Hace 2 días',
    nextDeadline: '20 Jun 2026',
    daysToDeadline: 46,
    assignedTo: 'Laura Sánchez',
    priority: 'alta',
    progress: 30,
    budget: 12000,
    hoursLogged: 28,
  },
  {
    id: '2026-085',
    client: 'Retail Pro España',
    type: 'Marketing',
    status: 'Completado',
    description: 'Campaña de marketing digital para lanzamiento de producto',
    openDate: '1 Feb 2026',
    lastUpdate: 'Hace 1 semana',
    assignedTo: 'Ana Martínez',
    priority: 'baja',
    progress: 100,
    budget: 6000,
    hoursLogged: 55,
  },
];

// --- CONTACTS ---
export const CONTACTS: Contact[] = [
  {
    id: 'CON-001',
    name: 'Innovatech Industries',
    type: 'Empresa',
    email: 'contacto@innovatech.es',
    phone: '+34 91 234 5678',
    status: 'Activo',
    activeProjects: 2,
    totalBilled: 45600,
    lastContact: 'Hoy, 10:30',
    address: 'Calle Serrano 45, Madrid',
    nif: 'B12345678',
    tags: ['Tech', 'Premium'],
    industry: 'Tecnología',
  },
  {
    id: 'CON-002',
    name: 'María García López',
    type: 'Autónomo',
    email: 'maria.garcia@mgconsulting.es',
    phone: '+34 679 123 456',
    status: 'Activo',
    activeProjects: 1,
    totalBilled: 12400,
    lastContact: 'Ayer, 15:00',
    tags: ['Consultoría'],
    industry: 'Consultoría',
  },
  {
    id: 'CON-003',
    name: 'Consultora Global S.L.',
    type: 'Empresa',
    email: 'info@consultoraglobal.es',
    phone: '+34 93 567 8901',
    status: 'Activo',
    activeProjects: 1,
    totalBilled: 28900,
    lastContact: 'Hace 3 días',
    address: 'Paseo de Gracia 100, Barcelona',
    nif: 'B98765432',
    tags: ['Estrategia', 'Premium'],
    industry: 'Consultoría',
  },
  {
    id: 'CON-004',
    name: 'StartUp Ventures S.L.',
    type: 'Empresa',
    email: 'hola@startupventures.es',
    phone: '+34 91 876 5432',
    status: 'Potencial',
    activeProjects: 1,
    totalBilled: 5200,
    lastContact: 'Hace 1 semana',
    tags: ['Startup', 'Nuevo'],
    industry: 'Inversión',
  },
  {
    id: 'CON-005',
    name: 'Carlos Rodríguez',
    type: 'Persona',
    email: 'carlos.r@retail-pro.es',
    phone: '+34 655 987 654',
    status: 'Inactivo',
    activeProjects: 0,
    totalBilled: 8700,
    lastContact: 'Hace 1 mes',
    industry: 'Retail',
  },
];

// --- INVOICES ---
export const INVOICES: Invoice[] = [
  {
    id: 'INV-001',
    number: '2026-089',
    client: 'Innovatech Industries',
    project: 'Plataforma Web',
    amount: 8264.46,
    vat: 1735.54,
    total: 10000,
    status: 'pendiente',
    issueDate: '1 May 2026',
    dueDate: '31 May 2026',
  },
  {
    id: 'INV-002',
    number: '2026-088',
    client: 'Consultora Global',
    project: 'Transformación Digital',
    amount: 2066.12,
    vat: 433.88,
    total: 2500,
    status: 'pagada',
    issueDate: '15 Abr 2026',
    dueDate: '15 May 2026',
    paidDate: '10 May 2026',
  },
  {
    id: 'INV-003',
    number: '2026-087',
    client: 'StartUp Ventures',
    project: 'Asesoría Estratégica',
    amount: 4132.23,
    vat: 867.77,
    total: 5000,
    status: 'vencida',
    issueDate: '1 Abr 2026',
    dueDate: '30 Abr 2026',
  },
  {
    id: 'INV-004',
    number: '2026-086',
    client: 'Estudio Creativo Luna',
    project: 'Branding',
    amount: 2892.56,
    vat: 607.44,
    total: 3500,
    status: 'borrador',
    issueDate: '10 May 2026',
    dueDate: '10 Jun 2026',
  },
];

// --- CALENDAR EVENTS ---
export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'EVT-001',
    title: 'Reunión de seguimiento',
    client: 'Innovatech Industries',
    type: 'reunion',
    date: '2026-05-14',
    time: '10:00',
    duration: '1h',
    status: 'confirmada',
    description: 'Revisión del avance de la plataforma web y próximos pasos',
  },
  {
    id: 'EVT-002',
    title: 'Llamada de presentación',
    client: 'StartUp Ventures',
    type: 'llamada',
    date: '2026-05-14',
    time: '12:30',
    duration: '30min',
    status: 'pendiente',
  },
  {
    id: 'EVT-003',
    title: 'Entrega propuesta branding',
    client: 'Estudio Creativo Luna',
    type: 'entrega',
    date: '2026-05-15',
    time: '17:00',
    duration: '—',
    status: 'pendiente',
    description: 'Primera entrega de propuestas de identidad visual',
  },
  {
    id: 'EVT-004',
    title: 'Demo plataforma',
    client: 'Consultora Global',
    type: 'reunion',
    date: '2026-05-16',
    time: '11:00',
    duration: '2h',
    status: 'confirmada',
  },
  {
    id: 'EVT-005',
    title: 'Pago factura vencida',
    client: 'StartUp Ventures',
    type: 'recordatorio',
    date: '2026-05-14',
    time: '09:00',
    duration: '—',
    status: 'pendiente',
    description: 'Recordar cobro de factura 2026-087 vencida',
  },
];

// --- IA CONTACTS ---
export const IA_CONTACTS: IaContact[] = [
  {
    id: 'IA-001',
    tipo: 'llamada',
    fecha: '14 May 2026',
    hora: '09:15',
    cliente: {
      nombre: 'María Fernández',
      telefono: '+34 612 345 678',
      email: 'maria.f@techcorp.es',
      empresa: 'TechCorp Solutions',
    },
    categoria: 'Presupuesto',
    descripcion: 'Solicita presupuesto para desarrollo de app móvil con integración de pagos',
    urgencia: 'alta',
    puntuacion: 92,
    estado: 'pendiente',
    duracion: '4:23',
  },
  {
    id: 'IA-002',
    tipo: 'whatsapp',
    fecha: '14 May 2026',
    hora: '08:45',
    cliente: {
      nombre: 'Pedro García',
      telefono: '+34 698 765 432',
      email: 'pedro@startup.es',
      empresa: null,
    },
    categoria: 'Consulta General',
    descripcion: 'Pregunta sobre servicios de consultoría estratégica para empresa de 20 personas',
    urgencia: 'normal',
    puntuacion: 74,
    estado: 'en_proceso',
    duracion: undefined,
  },
  {
    id: 'IA-003',
    tipo: 'llamada',
    fecha: '13 May 2026',
    hora: '16:30',
    cliente: {
      nombre: 'Ana Martínez',
      telefono: '+34 623 456 789',
      email: 'ana.m@distribuciones.es',
      empresa: 'Distribuciones Norte S.L.',
    },
    categoria: 'Demostracion',
    descripcion: 'Interesada en ver demo de la plataforma, ya conoce el producto por recomendación',
    urgencia: 'alta',
    puntuacion: 88,
    estado: 'resuelto',
    duracion: '6:12',
  },
  {
    id: 'IA-004',
    tipo: 'email',
    fecha: '13 May 2026',
    hora: '14:00',
    cliente: {
      nombre: 'Luis Hernández',
      telefono: '+34 677 890 123',
      email: 'luis.h@consultora.es',
      empresa: 'Consultora Hernández',
    },
    categoria: 'Soporte',
    descripcion: 'Duda sobre configuración de módulo de facturación y exportación a PDF',
    urgencia: 'baja',
    puntuacion: 45,
    estado: 'resuelto',
  },
  {
    id: 'IA-005',
    tipo: 'whatsapp',
    fecha: '13 May 2026',
    hora: '11:20',
    cliente: {
      nombre: 'Carmen López',
      telefono: '+34 644 567 890',
      email: 'carmen@diseno.es',
      empresa: 'Estudio Diseño CM',
    },
    categoria: 'Ventas',
    descripcion: 'Quiere ampliar plan actual a Profesional y añadir usuarios adicionales',
    urgencia: 'alta',
    puntuacion: 95,
    estado: 'pendiente',
  },
];

// --- DOCUMENTS ---
export const DOCUMENTS: AppDocument[] = [
  {
    id: 'DOC-001',
    name: 'Propuesta Comercial - Innovatech.pdf',
    type: 'Propuesta',
    client: 'Innovatech Industries',
    project: 'Plataforma Web',
    size: '2.4 MB',
    createdAt: '10 May 2026',
    updatedAt: '12 May 2026',
    status: 'revision',
  },
  {
    id: 'DOC-002',
    name: 'Contrato Servicio - Consultora Global.docx',
    type: 'Contrato',
    client: 'Consultora Global',
    project: 'Transformación Digital',
    size: '840 KB',
    createdAt: '5 Abr 2026',
    updatedAt: '5 Abr 2026',
    status: 'firmado',
  },
  {
    id: 'DOC-003',
    name: 'Brief Branding - Estudio Luna.pdf',
    type: 'Brief',
    client: 'Estudio Creativo Luna',
    project: 'Branding',
    size: '1.2 MB',
    createdAt: '10 Mar 2026',
    updatedAt: '11 Mar 2026',
    status: 'borrador',
  },
  {
    id: 'DOC-004',
    name: 'NDA - StartUp Ventures.pdf',
    type: 'Legal',
    client: 'StartUp Ventures',
    size: '320 KB',
    createdAt: '1 Mar 2026',
    updatedAt: '2 Mar 2026',
    status: 'firmado',
  },
  {
    id: 'DOC-005',
    name: 'Informe Mensual Abril 2026.pdf',
    type: 'Informe',
    client: 'Consultora Global',
    size: '3.1 MB',
    createdAt: '30 Abr 2026',
    updatedAt: '30 Abr 2026',
    status: 'archivado',
  },
];

// --- DASHBOARD STATS ---
export const DASHBOARD_STATS = {
  ingresosMes: '18.450 EUR',
  ingresosChange: '+15% vs anterior',
  contactosActivos: 156,
  contactosChange: '+12 este mes',
  citasHoy: 5,
  citasConfirmadas: 3,
  facturasPendientes: '4.200 EUR',
  facturasPendientesCount: 3,
  proyectosActivos: 24,
  proyectosChange: '+3 este mes',
  flujoCaja: '24.650 EUR',
  tareasUrgentes: 2,
  horasRegistradas: 142,
  horasObjetivo: 160,
};

// --- CASOS ---
export const CASOS: Caso[] = [
  { id: 'CASO-001', cliente: 'Innovatech Industries', tipo: 'Mercantil', estado: 'en_proceso', prioridad: 'alta', asignado: 'Carlos Mendoza', vencimiento: '30 May 2026', diasVencimiento: 25, descripcion: 'Revisión de contrato de distribución exclusiva' },
  { id: 'CASO-002', cliente: 'María García López', tipo: 'Laboral', estado: 'urgente', prioridad: 'alta', asignado: 'Ana Martínez', vencimiento: '20 May 2026', diasVencimiento: 15, descripcion: 'Despido improcedente — plazo de reclamación inminente' },
  { id: 'CASO-003', cliente: 'Consultora Global S.L.', tipo: 'Fiscal', estado: 'pendiente', prioridad: 'media', asignado: 'Laura Sánchez', vencimiento: '15 Jun 2026', diasVencimiento: 41, descripcion: 'Declaración modelo 303 segundo trimestre' },
  { id: 'CASO-004', cliente: 'StartUp Ventures S.L.', tipo: 'Mercantil', estado: 'pendiente', prioridad: 'media', asignado: 'Carlos Mendoza', vencimiento: '10 Jun 2026', diasVencimiento: 36, descripcion: 'Constitución de sociedad y estatutos sociales' },
  { id: 'CASO-005', cliente: 'Carlos Rodríguez', tipo: 'Civil', estado: 'en_proceso', prioridad: 'baja', asignado: 'Ana Martínez', vencimiento: '1 Jul 2026', diasVencimiento: 57, descripcion: 'Reclamación por daños en propiedad arrendada' },
  { id: 'CASO-006', cliente: 'Innovatech Industries', tipo: 'Legal', estado: 'cerrado', prioridad: 'baja', asignado: 'Laura Sánchez', vencimiento: '1 Abr 2026', diasVencimiento: -30, descripcion: 'Registro de marca nacional — resuelto satisfactoriamente' },
  { id: 'CASO-007', cliente: 'Distribuciones Norte S.L.', tipo: 'Fiscal', estado: 'urgente', prioridad: 'alta', asignado: 'Carlos Mendoza', vencimiento: '18 May 2026', diasVencimiento: 13, descripcion: 'Inspección de Hacienda — requerimiento de documentación' },
  { id: 'CASO-008', cliente: 'Estudio Creativo Luna', tipo: 'Laboral', estado: 'pendiente', prioridad: 'baja', asignado: 'Ana Martínez', vencimiento: '20 Jun 2026', diasVencimiento: 46, descripcion: 'Contrato de prestación de servicios con freelancer' },
];

// --- PIPELINE DEALS ---
export const PIPELINE_DEALS: PipelineDeal[] = [
  { id: 'PL-001', cliente: 'TechCorp Solutions', etapa: 'Lead', importe: 15000, probabilidad: 20, diasEnEtapa: 3, proximaAccion: 'Llamada de cualificación' },
  { id: 'PL-002', cliente: 'Moda Barcelona S.L.', etapa: 'Lead', importe: 8500, probabilidad: 25, diasEnEtapa: 7, proximaAccion: 'Enviar presentación' },
  { id: 'PL-003', cliente: 'Grupo Constructor Sur', etapa: 'Calificado', importe: 32000, probabilidad: 45, diasEnEtapa: 5, proximaAccion: 'Demo del producto' },
  { id: 'PL-004', cliente: 'Farmacia Salud Plus', etapa: 'Calificado', importe: 12000, probabilidad: 50, diasEnEtapa: 12, proximaAccion: 'Reunión con dirección' },
  { id: 'PL-005', cliente: 'Holding Peninsular', etapa: 'Propuesta', importe: 45000, probabilidad: 65, diasEnEtapa: 8, proximaAccion: 'Revisión de propuesta' },
  { id: 'PL-006', cliente: 'StartUp Ventures S.L.', etapa: 'Propuesta', importe: 9800, probabilidad: 60, diasEnEtapa: 4, proximaAccion: 'Respuesta en 2 días' },
  { id: 'PL-007', cliente: 'Consultora Global S.L.', etapa: 'Negociación', importe: 28000, probabilidad: 80, diasEnEtapa: 6, proximaAccion: 'Ajuste de condiciones' },
  { id: 'PL-008', cliente: 'Innovatech Industries', etapa: 'Ganado', importe: 25000, probabilidad: 100, diasEnEtapa: 2, proximaAccion: 'Firma de contrato' },
  { id: 'PL-009', cliente: 'Distribuciones Norte S.L.', etapa: 'Ganado', importe: 11500, probabilidad: 100, diasEnEtapa: 1, proximaAccion: 'Onboarding iniciado' },
];

// --- TESORERÍA ---
export interface TesoreríaCobro {
  id: string;
  cliente: string;
  factura: string;
  importe: number;
  diasVencido: number;
  nivel: 'recordatorio' | 'formal' | 'remesa' | 'aviso_legal';
  proximaAccion: string;
}

export interface BancTransaccion {
  id: string;
  fecha: string;
  descripcion: string;
  importe: number;
  estado: 'conciliado' | 'pendiente' | 'sin_conciliar';
}

export interface RentabilidadCliente {
  cliente: string;
  ingresos: number;
  costes: number;
  margen: number;
  diasPago: number;
}

export const TESORERIA_COBROS: TesoreríaCobro[] = [
  { id: 'COB-001', cliente: 'StartUp Ventures S.L.', factura: '2026-087', importe: 5000, diasVencido: 15, nivel: 'recordatorio', proximaAccion: 'Enviar recordatorio amistoso' },
  { id: 'COB-002', cliente: 'Retail Pro España', factura: '2026-082', importe: 3200, diasVencido: 32, nivel: 'formal', proximaAccion: 'Carta de reclamación formal' },
  { id: 'COB-003', cliente: 'Moda Barcelona S.L.', factura: '2026-078', importe: 7800, diasVencido: 55, nivel: 'remesa', proximaAccion: 'Gestión de cobro SEPA' },
  { id: 'COB-004', cliente: 'Grupo Sur', factura: '2026-070', importe: 12400, diasVencido: 91, nivel: 'aviso_legal', proximaAccion: 'Requerimiento notarial' },
];

export const BANCO_TRANSACCIONES: BancTransaccion[] = [
  { id: 'TRX-001', fecha: '14 May 2026', descripcion: 'Transferencia Consultora Global S.L.', importe: 2500, estado: 'conciliado' },
  { id: 'TRX-002', fecha: '13 May 2026', descripcion: 'Recibo domiciliado — Office 365', importe: -120, estado: 'conciliado' },
  { id: 'TRX-003', fecha: '12 May 2026', descripcion: 'Ingreso — ref: PAY-2024', importe: 8264, estado: 'pendiente' },
  { id: 'TRX-004', fecha: '11 May 2026', descripcion: 'Comisión mantenimiento cuenta', importe: -18, estado: 'conciliado' },
  { id: 'TRX-005', fecha: '10 May 2026', descripcion: 'Transferencia emitida — proveedor', importe: -950, estado: 'sin_conciliar' },
  { id: 'TRX-006', fecha: '9 May 2026', descripcion: 'Ingreso contado — cliente nuevo', importe: 1200, estado: 'pendiente' },
];

export const RENTABILIDAD_CLIENTES: RentabilidadCliente[] = [
  { cliente: 'Innovatech Industries', ingresos: 45600, costes: 18200, margen: 60, diasPago: 22 },
  { cliente: 'Consultora Global S.L.', ingresos: 28900, costes: 14500, margen: 50, diasPago: 30 },
  { cliente: 'María García López', ingresos: 12400, costes: 4800, margen: 61, diasPago: 15 },
  { cliente: 'StartUp Ventures S.L.', ingresos: 5200, costes: 3100, margen: 40, diasPago: 58 },
];

// --- COMUNICACIONES ---
export interface MensajeConversacion {
  id: string;
  texto: string;
  fecha: string;
  hora: string;
  entrante: boolean;
}

export interface Conversacion {
  id: string;
  contacto: string;
  empresa: string;
  canal: 'email' | 'whatsapp' | 'sms';
  ultimoMensaje: string;
  fecha: string;
  noLeidos: number;
  mensajes: MensajeConversacion[];
}

export interface Campana {
  id: string;
  nombre: string;
  canal: 'email' | 'whatsapp' | 'sms';
  estado: 'enviada' | 'borrador' | 'programada';
  enviados: number;
  abiertos: number;
  fecha: string;
}

export interface PlantillaMensaje {
  id: string;
  nombre: string;
  canal: 'email' | 'whatsapp' | 'sms';
  descripcion: string;
  usos: number;
}

export const CONVERSACIONES: Conversacion[] = [
  { id: 'CONV-001', contacto: 'María García López', empresa: 'MG Consulting', canal: 'email', ultimoMensaje: 'Perfecto, quedamos el lunes entonces.', fecha: 'Hoy, 11:20', noLeidos: 1, mensajes: [
    { id: 'm1', texto: '¿Podemos reunirnos esta semana?', fecha: '14 May 2026', hora: '10:00', entrante: true },
    { id: 'm2', texto: 'Sí, el lunes a las 10 me viene bien.', fecha: '14 May 2026', hora: '10:15', entrante: false },
    { id: 'm3', texto: 'Perfecto, quedamos el lunes entonces.', fecha: '14 May 2026', hora: '11:20', entrante: true },
  ]},
  { id: 'CONV-002', contacto: 'Innovatech Industries', empresa: 'Innovatech', canal: 'whatsapp', ultimoMensaje: 'Revisando la propuesta ahora mismo.', fecha: 'Ayer, 16:45', noLeidos: 0, mensajes: [
    { id: 'm4', texto: 'Os he enviado la propuesta actualizada.', fecha: '13 May 2026', hora: '15:00', entrante: false },
    { id: 'm5', texto: 'Revisando la propuesta ahora mismo.', fecha: '13 May 2026', hora: '16:45', entrante: true },
  ]},
  { id: 'CONV-003', contacto: 'Carlos Rodríguez', empresa: 'Retail Pro', canal: 'sms', ultimoMensaje: 'Recibido, gracias.', fecha: 'Hace 3 días', noLeidos: 0, mensajes: [
    { id: 'm6', texto: 'Le recuerdo el vencimiento de la factura 2026-085.', fecha: '11 May 2026', hora: '09:00', entrante: false },
    { id: 'm7', texto: 'Recibido, gracias.', fecha: '11 May 2026', hora: '09:30', entrante: true },
  ]},
];

export const CAMPANAS: Campana[] = [
  { id: 'CAM-001', nombre: 'Newsletter Mayo 2026', canal: 'email', estado: 'enviada', enviados: 234, abiertos: 142, fecha: '1 May 2026' },
  { id: 'CAM-002', nombre: 'Oferta verano — descuento 15%', canal: 'email', estado: 'borrador', enviados: 0, abiertos: 0, fecha: '—' },
  { id: 'CAM-003', nombre: 'Recordatorio facturas pendientes', canal: 'sms', estado: 'programada', enviados: 0, abiertos: 0, fecha: '20 May 2026' },
  { id: 'CAM-004', nombre: 'Encuesta satisfacción Q1', canal: 'email', estado: 'enviada', enviados: 189, abiertos: 97, fecha: '1 Abr 2026' },
];

export const PLANTILLAS_MENSAJE: PlantillaMensaje[] = [
  { id: 'PLT-001', nombre: 'Bienvenida nuevo cliente', canal: 'email', descripcion: 'Email de onboarding para clientes nuevos', usos: 45 },
  { id: 'PLT-002', nombre: 'Recordatorio de pago', canal: 'sms', descripcion: 'SMS de recordatorio de factura vencida', usos: 128 },
  { id: 'PLT-003', nombre: 'Propuesta comercial', canal: 'email', descripcion: 'Plantilla para envío de presupuestos', usos: 67 },
  { id: 'PLT-004', nombre: 'Seguimiento reunión', canal: 'whatsapp', descripcion: 'Mensaje post-reunión con resumen', usos: 34 },
  { id: 'PLT-005', nombre: 'Informe mensual', canal: 'email', descripcion: 'Resumen de actividad mensual para el cliente', usos: 22 },
];

// --- USUARIOS EMPRESA ---
export interface UsuarioEmpresa {
  id: string;
  nombre: string;
  email: string;
  rol: 'Admin' | 'Gestor' | 'Usuario' | 'Viewer';
  departamento: string;
  estado: 'activo' | 'inactivo' | 'pendiente';
  ultimoLogin: string;
}

export interface RolEmpresa {
  id: string;
  nombre: string;
  descripcion: string;
  usuarios: number;
  color: string;
}

export const USUARIOS_EMPRESA: UsuarioEmpresa[] = [
  { id: 'USR-001', nombre: 'Carlos Mendoza', email: 'c.mendoza@zoem.es', rol: 'Admin', departamento: 'Dirección', estado: 'activo', ultimoLogin: 'Hoy, 09:15' },
  { id: 'USR-002', nombre: 'Ana Martínez', email: 'a.martinez@zoem.es', rol: 'Gestor', departamento: 'Proyectos', estado: 'activo', ultimoLogin: 'Hoy, 08:30' },
  { id: 'USR-003', nombre: 'Laura Sánchez', email: 'l.sanchez@zoem.es', rol: 'Gestor', departamento: 'Legal', estado: 'activo', ultimoLogin: 'Ayer, 17:00' },
  { id: 'USR-004', nombre: 'Pedro García', email: 'p.garcia@zoem.es', rol: 'Usuario', departamento: 'Administración', estado: 'activo', ultimoLogin: 'Hace 3 días' },
  { id: 'USR-005', nombre: 'Isabel Torres', email: 'i.torres@zoem.es', rol: 'Viewer', departamento: 'Contabilidad', estado: 'pendiente', ultimoLogin: '—' },
];

export const ROLES_EMPRESA: RolEmpresa[] = [
  { id: 'ROL-001', nombre: 'Admin', descripcion: 'Acceso total a todos los módulos y configuraciones', usuarios: 1, color: 'bg-red-100 text-red-700' },
  { id: 'ROL-002', nombre: 'Gestor', descripcion: 'Gestión de proyectos, clientes y facturación', usuarios: 2, color: 'bg-violet-100 text-violet-700' },
  { id: 'ROL-003', nombre: 'Usuario', descripcion: 'Acceso estándar a módulos operativos', usuarios: 1, color: 'bg-blue-100 text-blue-700' },
  { id: 'ROL-004', nombre: 'Viewer', descripcion: 'Solo lectura en todos los módulos', usuarios: 1, color: 'bg-slate-100 text-slate-600' },
];

// --- REGISTRO DE HORAS ---
export const REGISTRO_HORAS: RegistroHora[] = [
  { id: 'HR-001', fecha: '14 May 2026', cliente: 'Innovatech Industries', proyecto: 'Plataforma Web', descripcion: 'Desarrollo módulo de autenticación', horas: 4, importe: 280, estadoFacturacion: 'pendiente' },
  { id: 'HR-002', fecha: '14 May 2026', cliente: 'Consultora Global S.L.', proyecto: 'Transformación Digital', descripcion: 'Análisis de procesos actuales', horas: 3, importe: 210, estadoFacturacion: 'facturado' },
  { id: 'HR-003', fecha: '13 May 2026', cliente: 'Innovatech Industries', proyecto: 'Plataforma Web', descripcion: 'Reunión de seguimiento con cliente', horas: 1, importe: 70, estadoFacturacion: 'facturado' },
  { id: 'HR-004', fecha: '13 May 2026', cliente: 'StartUp Ventures S.L.', proyecto: 'Asesoría Estratégica', descripcion: 'Preparación de informe estratégico', horas: 5, importe: 350, estadoFacturacion: 'pendiente' },
  { id: 'HR-005', fecha: '12 May 2026', cliente: 'Estudio Creativo Luna', proyecto: 'Branding', descripcion: 'Conceptualización de identidad visual', horas: 6, importe: 420, estadoFacturacion: 'pendiente' },
  { id: 'HR-006', fecha: '12 May 2026', cliente: 'Consultora Global S.L.', proyecto: 'Transformación Digital', descripcion: 'Taller con equipo directivo', horas: 3.5, importe: 245, estadoFacturacion: 'facturado' },
  { id: 'HR-007', fecha: '10 May 2026', cliente: 'Innovatech Industries', proyecto: 'Plataforma Web', descripcion: 'Testing y corrección de bugs', horas: 2, importe: 140, estadoFacturacion: 'no_facturable' },
  { id: 'HR-008', fecha: '9 May 2026', cliente: 'StartUp Ventures S.L.', proyecto: 'Asesoría Estratégica', descripcion: 'Presentación modelo de negocio', horas: 2, importe: 140, estadoFacturacion: 'facturado' },
];

// --- TAREAS POR PROYECTO ---
export const PROJECT_TASKS: Record<string, Tarea[]> = {
  '2026-089': [
    { id: 'T-001', titulo: 'Diseño de arquitectura backend', estado: 'completada' },
    { id: 'T-002', titulo: 'Módulo de autenticación OAuth', estado: 'completada' },
    { id: 'T-003', titulo: 'Dashboard de analytics', estado: 'en_proceso' },
    { id: 'T-004', titulo: 'Integración con API de pagos', estado: 'pendiente' },
    { id: 'T-005', titulo: 'Testing end-to-end', estado: 'pendiente' },
  ],
  '2026-088': [
    { id: 'T-006', titulo: 'Brief creativo y moodboard', estado: 'completada' },
    { id: 'T-007', titulo: 'Propuestas de logotipo (3 opciones)', estado: 'en_proceso' },
    { id: 'T-008', titulo: 'Manual de identidad visual', estado: 'pendiente' },
    { id: 'T-009', titulo: 'Aplicaciones en papelería y digital', estado: 'pendiente' },
  ],
  '2026-087': [
    { id: 'T-010', titulo: 'Diagnóstico inicial de procesos', estado: 'completada' },
    { id: 'T-011', titulo: 'Entrevistas con equipo directivo', estado: 'completada' },
    { id: 'T-012', titulo: 'Hoja de ruta de transformación', estado: 'en_proceso' },
    { id: 'T-013', titulo: 'Plan de implementación por fases', estado: 'pendiente' },
  ],
  '2026-086': [
    { id: 'T-014', titulo: 'Análisis de mercado y competencia', estado: 'completada' },
    { id: 'T-015', titulo: 'Definición de propuesta de valor', estado: 'en_proceso' },
    { id: 'T-016', titulo: 'Modelo financiero proyectado', estado: 'pendiente' },
  ],
  '2026-085': [
    { id: 'T-017', titulo: 'Estrategia de campaña digital', estado: 'completada' },
    { id: 'T-018', titulo: 'Producción de creatividades', estado: 'completada' },
    { id: 'T-019', titulo: 'Lanzamiento y monitorización', estado: 'completada' },
  ],
};

export const PROJECT_HISTORY: Record<string, HistorialEntry[]> = {
  '2026-089': [
    { id: 'H-001', fecha: 'Hoy, 10:30', evento: 'Reunión de seguimiento completada', usuario: 'Carlos Mendoza' },
    { id: 'H-002', fecha: 'Ayer, 15:00', evento: 'Módulo de autenticación entregado', usuario: 'Carlos Mendoza' },
    { id: 'H-003', fecha: '10 May 2026', evento: 'Revisión de arquitectura aprobada por cliente', usuario: 'Ana Martínez' },
    { id: 'H-004', fecha: '5 May 2026', evento: 'Proyecto iniciado — kickoff meeting', usuario: 'Carlos Mendoza' },
  ],
  '2026-088': [
    { id: 'H-005', fecha: 'Ayer, 17:00', evento: 'Propuestas de logotipo en revisión', usuario: 'Ana Martínez' },
    { id: 'H-006', fecha: '10 Mar 2026', evento: 'Brief creativo aprobado', usuario: 'Ana Martínez' },
  ],
};

export const ACTIVITY_FEED = [
  {
    id: 1,
    icon: 'phone',
    title: 'Nueva llamada IA atendida',
    description: 'María García — TechCorp Solutions',
    time: 'Hace 15 min',
    color: 'text-green-600',
    bg: 'bg-green-100',
    href: '/recepcion-ia',
  },
  {
    id: 2,
    icon: 'receipt',
    title: 'Factura enviada',
    description: '#2026-089 — Innovatech Industries',
    time: 'Hace 1 hora',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    href: '/facturacion',
  },
  {
    id: 3,
    icon: 'folder',
    title: 'Proyecto actualizado',
    description: 'Web Corporativa Garcia SL — 75% completado',
    time: 'Hace 2 horas',
    color: 'text-violet-600',
    bg: 'bg-violet-100',
    href: '/proyectos',
  },
  {
    id: 4,
    icon: 'wallet',
    title: 'Pago recibido',
    description: 'Consultora Global — 2.500 EUR',
    time: 'Hace 3 horas',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    href: '/tesoreria',
  },
  {
    id: 5,
    icon: 'file',
    title: 'Documento firmado',
    description: 'Contrato servicio — StartUp Ventures',
    time: 'Hace 5 horas',
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    href: '/documentos',
  },
];
