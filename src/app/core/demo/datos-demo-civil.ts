/**
 * Datos de la empresa demo "despacho de abogado civil" que se enseña a prospectos.
 * Solo datos: la construcción de documentos vive en `seed-demo-civil.ts`.
 * Las fechas son desplazamientos en días respecto a HOY para que la demo
 * siempre parezca de esta semana.
 */
import type { ContactStatus, CanalEntrada, Direccion } from '../../interfaces/contact.interface';
import type { CasoEstado, CasoPrioridad } from '../../interfaces/caso.interface';
import type { MovimientoTipo } from '../../interfaces/gestoria.interface';
import type { TipoCosto } from '../../interfaces/plantilla.interface';
import type { TipoIva } from '../../interfaces/iva';
import type { EventoColor, EventoEstado, EventoPrioridad, EventoRecurrencia } from '../../interfaces/evento.interface';
import type { AmbitoAccion, Canal } from '../../interfaces/accion.interface';
import type { InvoiceStatus } from '../services/invoice.service';
import type { Modulo } from '../permissions/permissions';

const MADRID = { municipio: 'Madrid', provincia: 'Madrid', pais: 'ES' } as const;
const dir = (calle: string, numero: string, codigoPostal: string, piso?: string): Direccion =>
  ({ calle, numero, codigoPostal, ...(piso ? { piso } : {}), ...MADRID });

interface ContactoComun {
  email: string;
  phone?: string;
  mobile?: string;
  language: string;
  status: ContactStatus;
  canalEntrada: CanalEntrada;
  asunto: string;
  tags: string[];
  /** Días desde el alta y desde el último contacto. */
  alta: number;
  ultimoContacto: number;
}

export type ContactoDemo =
  | (ContactoComun & {
      type: 'persona_fisica';
      nombre: string;
      apellidos: string;
      nifType: 'dni' | 'nie';
      nif: string;
      estadoCivil: 'soltero' | 'casado' | 'divorciado' | 'viudo' | 'pareja_hecho';
      profesion: string;
      nacionalidad: string;
      direccion: Direccion;
    })
  | (ContactoComun & {
      type: 'persona_juridica';
      razonSocial: string;
      nombreComercial?: string;
      formaJuridica: string;
      cifType: 'cif';
      cif: string;
      sectorActividad: string;
      website?: string;
      registroMercantil?: string;
      representanteLegalNombre: string;
      direccionSocial: Direccion;
    });

export const CONTACTOS: readonly ContactoDemo[] = [
  {
    type: 'persona_fisica', nombre: 'María', apellidos: 'García López', nifType: 'dni', nif: '12345678Z',
    email: 'maria.garcia@example.com', mobile: '+34 612 345 678', estadoCivil: 'casado', profesion: 'Profesora',
    nacionalidad: 'ES', language: 'es', direccion: dir('Calle Mayor', '14', '28013', '3ºB'),
    status: 'activo', canalEntrada: 'referido', asunto: 'Herencia de su padre (testamento abierto)',
    tags: ['herencia', 'testamentaría'], alta: 45, ultimoContacto: 3,
  },
  {
    type: 'persona_fisica', nombre: 'Javier', apellidos: 'Martín Ruiz', nifType: 'dni', nif: '23456789D',
    email: 'javier.martin@example.com', mobile: '+34 623 456 789', estadoCivil: 'divorciado', profesion: 'Ingeniero',
    nacionalidad: 'ES', language: 'es', direccion: dir('Avenida de América', '52', '28028'),
    status: 'activo', canalEntrada: 'web', asunto: 'Inquilino con 4 mensualidades impagadas',
    tags: ['arrendamientos', 'desahucio'], alta: 30, ultimoContacto: 1,
  },
  {
    type: 'persona_fisica', nombre: 'Lucía', apellidos: 'Fernández Sánchez', nifType: 'dni', nif: '34567890V',
    email: 'lucia.fernandez@example.com', mobile: '+34 634 567 890', estadoCivil: 'casado', profesion: 'Arquitecta',
    nacionalidad: 'ES', language: 'es', direccion: dir('Calle Serrano', '88', '28006', '1ºA'),
    status: 'pendiente_firma_hoja_encargo', canalEntrada: 'telefono', asunto: 'Divorcio de mutuo acuerdo con convenio regulador',
    tags: ['familia', 'divorcio'], alta: 6, ultimoContacto: 2,
  },
  {
    type: 'persona_fisica', nombre: 'Antonio', apellidos: 'Pérez Gómez', nifType: 'dni', nif: '45678901G',
    email: 'antonio.perez@example.com', phone: '+34 915 551 234', estadoCivil: 'viudo', profesion: 'Jubilado',
    nacionalidad: 'ES', language: 'es', direccion: dir('Calle Alcalá', '201', '28028'),
    status: 'pendiente_presupuesto', canalEntrada: 'presencial', asunto: 'Humedades por defectos de construcción en su vivienda',
    tags: ['responsabilidad civil', 'vicios constructivos'], alta: 4, ultimoContacto: 4,
  },
  {
    type: 'persona_fisica', nombre: 'Elena', apellidos: 'Romero Díaz', nifType: 'dni', nif: '56789012B',
    email: 'elena.romero@example.com', mobile: '+34 645 678 901', estadoCivil: 'soltero', profesion: 'Enfermera',
    nacionalidad: 'ES', language: 'es', direccion: dir('Calle Princesa', '25', '28008', '5ºC'),
    status: 'potencial', canalEntrada: 'redes_sociales', asunto: 'Reclamación de fianza al casero',
    tags: ['arrendamientos'], alta: 2, ultimoContacto: 2,
  },
  {
    type: 'persona_fisica', nombre: 'Carlos', apellidos: 'Navarro Torres', nifType: 'dni', nif: '67890123M',
    email: 'carlos.navarro@example.com', mobile: '+34 656 789 012', estadoCivil: 'casado', profesion: 'Comercial',
    nacionalidad: 'ES', language: 'es', direccion: dir('Paseo de la Castellana', '120', '28046'),
    status: 'pendiente_pago', canalEntrada: 'referido', asunto: 'Reclamación de deuda a un cliente (monitorio)',
    tags: ['reclamación de cantidad', 'monitorio'], alta: 20, ultimoContacto: 7,
  },
  {
    type: 'persona_fisica', nombre: 'Sophie', apellidos: 'Dubois', nifType: 'nie', nif: 'X1234567L',
    email: 'sophie.dubois@example.com', mobile: '+34 667 890 123', estadoCivil: 'pareja_hecho', profesion: 'Diseñadora',
    nacionalidad: 'FR', language: 'fr', direccion: dir('Calle Fuencarral', '60', '28004', '2ºD'),
    status: 'activo', canalEntrada: 'email', asunto: 'Medidas paternofiliales tras ruptura de pareja de hecho',
    tags: ['familia', 'custodia'], alta: 60, ultimoContacto: 10,
  },
  {
    type: 'persona_fisica', nombre: 'Manuel', apellidos: 'Ortega Castro', nifType: 'dni', nif: '78901234Y',
    email: 'manuel.ortega@example.com', mobile: '+34 678 901 234', estadoCivil: 'casado', profesion: 'Autónomo (fontanero)',
    nacionalidad: 'ES', language: 'es', direccion: dir('Calle Bravo Murillo', '300', '28020'),
    status: 'cerrado_finalizado', canalEntrada: 'telefono', asunto: 'Accidente de tráfico — indemnización cobrada',
    tags: ['responsabilidad civil', 'tráfico'], alta: 210, ultimoContacto: 35,
  },
  {
    type: 'persona_juridica', razonSocial: 'Inmobiliaria Solaz S.L.', nombreComercial: 'Solaz Inmuebles',
    formaJuridica: 'S.L.', cifType: 'cif', cif: 'B12345674', email: 'administracion@solaz.example.com', phone: '+34 914 445 566',
    sectorActividad: 'Gestión de alquileres', website: 'https://solaz.example.com',
    registroMercantil: 'Madrid, Tomo 12345, Folio 67, Hoja M-123456', representanteLegalNombre: 'Rosa Jiménez Vidal',
    language: 'es', direccionSocial: dir('Calle Goya', '45', '28001'),
    status: 'activo', canalEntrada: 'referido', asunto: 'Cartera de desahucios y reclamaciones de rentas',
    tags: ['arrendamientos', 'cliente recurrente'], alta: 120, ultimoContacto: 5,
  },
  {
    type: 'persona_juridica', razonSocial: 'Comunidad de Propietarios Calle Velázquez 30',
    formaJuridica: 'Comunidad de propietarios', cifType: 'cif', cif: 'H87654321',
    email: 'administrador@cpvelazquez30.example.com', phone: '+34 913 332 211', sectorActividad: 'Propiedad horizontal',
    representanteLegalNombre: 'Luis Herrera Molina (presidente)', language: 'es',
    direccionSocial: dir('Calle Velázquez', '30', '28001'),
    status: 'integracion_plantillas', canalEntrada: 'email', asunto: 'Reclamación de cuotas a propietarios morosos',
    tags: ['propiedad horizontal', 'morosos'], alta: 15, ultimoContacto: 6,
  },
];

// ---------------------------------------------------------------------------

export interface HitoDemo {
  titulo: string;
  diasDesdeInicio: number;
  descripcion?: string;
}

export interface PlantillaDemo {
  key: string;
  nombre: string;
  descripcion: string;
  hitos: readonly HitoDemo[];
  honorariosBase: number;
  suplidos: readonly { nombre: string; tipo: TipoCosto; importeEstimado?: number }[];
}

const h = (titulo: string, diasDesdeInicio: number, descripcion?: string): HitoDemo =>
  ({ titulo, diasDesdeInicio, ...(descripcion ? { descripcion } : {}) });

export const PLANTILLAS: readonly PlantillaDemo[] = [
  {
    key: 'desahucio-impago',
    nombre: 'Desahucio por falta de pago',
    descripcion: 'Juicio verbal de desahucio por impago de rentas con reclamación acumulada de cantidades adeudadas (art. 250.1.1º LEC).',
    hitos: [
      h('Reunión inicial y revisión del contrato de arrendamiento', 0, 'Contrato, recibos impagados, datos del inquilino.'),
      h('Burofax de requerimiento de pago al inquilino', 3, 'Requerimiento fehaciente; evita la enervación posterior.'),
      h('Redacción y presentación de la demanda', 15, 'Demanda de desahucio + reclamación de rentas.'),
      h('Admisión a trámite y requerimiento del LAJ', 40, 'Plazo de 10 días para pagar, desalojar u oponerse.'),
      h('Vista oral (si hay oposición)', 75),
      h('Sentencia', 90),
      h('Lanzamiento y recuperación de la posesión', 120, 'Asistencia a la diligencia de lanzamiento.'),
    ],
    honorariosBase: 900,
    suplidos: [
      { nombre: 'Burofax con certificación de texto', tipo: 'suplido', importeEstimado: 30 },
      { nombre: 'Derechos de procurador', tipo: 'suplido', importeEstimado: 180 },
      { nombre: 'Provisión de fondos inicial', tipo: 'provisiones_fondos', importeEstimado: 500 },
    ],
  },
  {
    key: 'divorcio-mutuo-acuerdo',
    nombre: 'Divorcio de mutuo acuerdo',
    descripcion: 'Divorcio consensuado con convenio regulador (custodia, pensiones, uso de vivienda y liquidación de gananciales).',
    hitos: [
      h('Entrevista con ambos cónyuges', 0, 'Recogida de documentación: libro de familia, certificado de matrimonio, nóminas.'),
      h('Redacción del convenio regulador', 7),
      h('Revisión y firma del convenio', 14),
      h('Presentación de la demanda de divorcio', 18),
      h('Ratificación ante el juzgado', 45, 'Comparecencia de ambos cónyuges por separado.'),
      h('Informe del Ministerio Fiscal (si hay hijos menores)', 55),
      h('Sentencia de divorcio', 75),
      h('Inscripción en el Registro Civil', 90),
    ],
    honorariosBase: 1200,
    suplidos: [
      { nombre: 'Certificados del Registro Civil', tipo: 'suplido', importeEstimado: 0 },
      { nombre: 'Derechos de procurador', tipo: 'suplido', importeEstimado: 150 },
    ],
  },
  {
    key: 'herencia-testamentaria',
    nombre: 'Tramitación de herencia',
    descripcion: 'Aceptación y partición de herencia: certificados, inventario, escritura notarial, impuestos y cambios de titularidad.',
    hitos: [
      h('Reunión con herederos y recopilación de documentos', 0),
      h('Solicitud de certificado de defunción y de últimas voluntades', 2),
      h('Obtención de copia autorizada del testamento', 20),
      h('Inventario y valoración de bienes', 30, 'Inmuebles, cuentas, vehículos, deudas.'),
      h('Cuaderno particional y firma de escritura ante notario', 60),
      h('Liquidación del Impuesto de Sucesiones', 75, 'Plazo legal: 6 meses desde el fallecimiento.'),
      h('Plusvalía municipal', 80),
      h('Inscripción en el Registro de la Propiedad y cambio de titularidades', 110),
    ],
    honorariosBase: 1500,
    suplidos: [
      { nombre: 'Certificado de últimas voluntades', tipo: 'suplido', importeEstimado: 4 },
      { nombre: 'Notaría (escritura de aceptación y partición)', tipo: 'gastos_repercutibles', importeEstimado: 600 },
      { nombre: 'Registro de la Propiedad', tipo: 'gastos_repercutibles', importeEstimado: 250 },
    ],
  },
  {
    key: 'monitorio',
    nombre: 'Reclamación de cantidad (monitorio)',
    descripcion: 'Procedimiento monitorio para reclamar deudas dinerarias líquidas, vencidas y exigibles documentadas.',
    hitos: [
      h('Análisis de la deuda y documentación', 0, 'Facturas, contratos, albaranes, comunicaciones.'),
      h('Requerimiento extrajudicial de pago', 3),
      h('Presentación de la petición de monitorio', 20),
      h('Requerimiento judicial de pago al deudor (20 días)', 45),
      h('Oposición: transformación a juicio verbal/ordinario', 75, 'Solo si el deudor se opone.'),
      h('Decreto / sentencia', 100),
      h('Ejecución y embargo', 130),
    ],
    honorariosBase: 600,
    suplidos: [
      { nombre: 'Burofax', tipo: 'suplido', importeEstimado: 30 },
      { nombre: 'Cuota litis (10% de lo recobrado)', tipo: 'cuota_litis' },
      { nombre: 'Intereses de demora', tipo: 'intereses_demora' },
    ],
  },
  {
    key: 'responsabilidad-civil',
    nombre: 'Reclamación por responsabilidad civil',
    descripcion: 'Reclamación de daños y perjuicios (vicios constructivos, accidentes, daños materiales) con informe pericial.',
    hitos: [
      h('Entrevista y valoración preliminar del caso', 0),
      h('Encargo de informe pericial', 7),
      h('Reclamación extrajudicial a la parte responsable / aseguradora', 30),
      h('Negociación y propuesta de acuerdo', 50),
      h('Presentación de la demanda', 75),
      h('Audiencia previa', 150),
      h('Juicio', 220),
      h('Sentencia y cobro de la indemnización', 260),
    ],
    honorariosBase: 2000,
    suplidos: [
      { nombre: 'Informe pericial', tipo: 'suplido', importeEstimado: 800 },
      { nombre: 'Derechos de procurador', tipo: 'suplido', importeEstimado: 300 },
      { nombre: 'Provisión de fondos', tipo: 'provisiones_fondos', importeEstimado: 1000 },
    ],
  },
];

// ---------------------------------------------------------------------------

export type CuentaDemo = 'operativa' | 'clientes' | 'caja';

export const CUENTAS: Record<CuentaDemo, { id: string; nombre: string; tipo: 'banco' | 'caja'; entidad?: string; iban?: string; inicial: number }> = {
  operativa: { id: 'demo-cuenta-operativa', nombre: 'Cuenta operativa del despacho', tipo: 'banco', entidad: 'BBVA', iban: 'ES76 0182 1234 5612 3456 7890', inicial: 18_000 },
  clientes: { id: 'demo-cuenta-clientes', nombre: 'Cuenta de clientes (provisiones)', tipo: 'banco', entidad: 'Banco Santander', iban: 'ES12 0049 4321 1234 5678 9012', inicial: 12_000 },
  caja: { id: 'demo-cuenta-caja', nombre: 'Caja del despacho', tipo: 'caja', inicial: 350 },
};

export interface MovDemo {
  key: string;
  tipo: MovimientoTipo;
  concepto: string;
  /** Total de caja (base + IVA). */
  importe: number;
  esEntrada: boolean;
  /** Días respecto a hoy (negativo = pasado). */
  offset: number;
  iva: TipoIva;
  cuenta: CuentaDemo;
  aprobado: boolean;
}

const m = (
  key: string, tipo: MovimientoTipo, concepto: string, importe: number, esEntrada: boolean,
  hace: number, iva: TipoIva, cuenta: CuentaDemo, aprobado = true,
): MovDemo => ({ key, tipo, concepto, importe, esEntrada, offset: -hace, iva, cuenta, aprobado });

export interface FacturaDemo {
  key: string;
  status: InvoiceStatus;
  offset: number;
  /** [concepto, base] al 21 %. */
  lineas: readonly (readonly [string, number])[];
  venceEn: number;
}

const f = (key: string, status: InvoiceStatus, hace: number, lineas: FacturaDemo['lineas']): FacturaDemo =>
  ({ key, status, offset: -hace, lineas, venceEn: 30 });

export interface CasoDemo {
  key: string;
  titulo: string;
  descripcion: string;
  /** Índices en CONTACTOS. */
  contactos: readonly number[];
  plantilla?: string;
  /** Hitos propios cuando no hay plantilla. */
  hitos?: readonly HitoDemo[];
  /** Hace cuántos días empezó. */
  inicio: number;
  estado: CasoEstado;
  prioridad: CasoPrioridad;
  /** Vencimiento en días respecto a hoy. */
  vence: number;
  movs: readonly MovDemo[];
  /** Índice de slot (0 = honorarios base, luego suplidos) → key del movimiento que lo registra. */
  slots: Readonly<Record<number, string>>;
  facturas: readonly FacturaDemo[];
  /** Hace cuántos días se confirmó el cierre. */
  cierre?: number;
}

export const CASOS: readonly CasoDemo[] = [
  {
    key: 'desahucio-martin', titulo: 'Desahucio C/ Ríos Rosas 12 — Martín Ruiz',
    descripcion: 'Inquilino con 4 mensualidades impagadas (3.400 €). Se acumula la reclamación de rentas.',
    contactos: [1], plantilla: 'desahucio-impago', inicio: 28, estado: 'en_proceso', prioridad: 'alta', vence: 60,
    movs: [
      m('provision', 'ingreso', 'Provisión de fondos inicial', 500, true, 27, 0, 'clientes'),
      m('hon', 'honorario', 'Honorarios desahucio — 50% a la firma del encargo', 544.5, true, 27, 21, 'operativa'),
      m('burofax', 'suplido', 'Burofax con certificación de texto', 30, false, 25, 0, 'clientes'),
      m('procurador', 'suplido', 'Derechos de procurador (demanda)', 180, false, 12, 0, 'clientes', false),
    ],
    slots: { 1: 'burofax', 2: 'procurador', 3: 'provision' },
    facturas: [
      f('martin-1', 'pagada', 27, [['Honorarios desahucio — 50% a la firma del encargo', 450]]),
      f('martin-2', 'borrador', 0, [['Honorarios desahucio — 50% restante', 450]]),
    ],
  },
  {
    key: 'desahucio-solaz-goya', titulo: 'Desahucio vivienda C/ Goya 45, 3ºA — Solaz',
    descripcion: 'Arrendatario en rebeldía. Sentencia estimatoria; pendiente la diligencia de lanzamiento.',
    contactos: [8], plantilla: 'desahucio-impago', inicio: 100, estado: 'urgente', prioridad: 'alta', vence: 25,
    movs: [
      m('provision', 'ingreso', 'Provisión de fondos', 500, true, 99, 0, 'clientes'),
      m('burofax', 'suplido', 'Burofax de requerimiento', 30, false, 97, 0, 'clientes'),
      m('hon', 'honorario', 'Honorarios procedimiento de desahucio', 1089, true, 95, 21, 'operativa'),
      m('procurador', 'suplido', 'Derechos de procurador', 180, false, 80, 0, 'clientes'),
    ],
    slots: { 0: 'hon', 1: 'burofax', 2: 'procurador', 3: 'provision' },
    facturas: [f('solaz-goya', 'pagada', 95, [['Honorarios procedimiento de desahucio C/ Goya 45', 900]])],
  },
  {
    key: 'herencia-garcia', titulo: 'Herencia de D. Ramón García Ortiz',
    descripcion: 'Testamento abierto. Tres herederos; vivienda en Madrid, plaza de garaje y dos cuentas bancarias.',
    contactos: [0], plantilla: 'herencia-testamentaria', inicio: 44, estado: 'en_proceso', prioridad: 'media', vence: 70,
    movs: [
      m('provision', 'ingreso', 'Provisión de fondos para gastos de la herencia', 1200, true, 43, 0, 'clientes'),
      m('hon', 'honorario', 'Honorarios herencia — primer pago (50%)', 907.5, true, 43, 21, 'operativa'),
      m('ultimas', 'suplido', 'Certificado de últimas voluntades', 3.82, false, 41, 0, 'caja'),
      m('notaria', 'suplido', 'Notaría — copia autorizada del testamento', 72.6, false, 22, 21, 'clientes', false),
    ],
    slots: { 1: 'ultimas' },
    facturas: [f('garcia-1', 'pagada', 43, [['Tramitación de herencia — primer pago (50%)', 750]])],
  },
  {
    key: 'divorcio-fernandez', titulo: 'Divorcio de mutuo acuerdo Fernández — Ortiz',
    descripcion: 'Dos hijos menores. Custodia compartida y uso de la vivienda familiar por turnos.',
    contactos: [2], plantilla: 'divorcio-mutuo-acuerdo', inicio: 3, estado: 'pendiente', prioridad: 'media', vence: 90,
    movs: [], slots: {}, facturas: [],
  },
  {
    key: 'monitorio-navarro', titulo: 'Monitorio contra Reformas Levante S.L. (12.480 €)',
    descripcion: 'Facturas de suministro impagadas desde marzo. Hay albaranes firmados.',
    contactos: [5], plantilla: 'monitorio', inicio: 22, estado: 'en_proceso', prioridad: 'media', vence: 120,
    movs: [m('burofax', 'suplido', 'Burofax de requerimiento de pago', 30, false, 19, 0, 'operativa')],
    slots: { 1: 'burofax' },
    facturas: [f('navarro', 'pendiente', 21, [['Honorarios procedimiento monitorio', 600]])],
  },
  {
    key: 'rc-perez', titulo: 'Humedades por vicios constructivos — Promociones Alcalá',
    descripcion: 'Filtraciones en el salón desde 2024. La promotora no responde a las reclamaciones.',
    contactos: [3], plantilla: 'responsabilidad-civil', inicio: 2, estado: 'pendiente', prioridad: 'media', vence: 260,
    movs: [], slots: {}, facturas: [],
  },
  {
    key: 'medidas-dubois', titulo: 'Modificación de medidas paternofiliales — Dubois',
    descripcion: 'Cambio de régimen de visitas por traslado de domicilio del otro progenitor.',
    contactos: [6], inicio: 58, estado: 'en_proceso', prioridad: 'alta', vence: 40,
    hitos: [
      h('Entrevista inicial y estudio del convenio vigente', 0),
      h('Intento de mediación familiar', 10),
      h('Presentación de la demanda de modificación de medidas', 21),
      h('Informe del equipo psicosocial', 50),
      h('Vista', 70),
      h('Sentencia', 95),
    ],
    movs: [
      m('provision', 'ingreso', 'Provisión de fondos', 800, true, 57, 0, 'clientes'),
      m('psicologo', 'suplido', 'Informe psicológico de parte', 450, false, 30, 0, 'clientes'),
    ],
    slots: {},
    facturas: [f('dubois', 'vencida', 50, [['Honorarios modificación de medidas — primera fase', 800]])],
  },
  {
    key: 'trafico-ortega', titulo: 'Accidente de tráfico A-6 — Ortega Castro',
    descripcion: 'Reclamación a la aseguradora contraria. Acuerdo extrajudicial tras la audiencia previa.',
    contactos: [7], plantilla: 'responsabilidad-civil', inicio: 205, estado: 'cerrado', prioridad: 'baja', vence: -35,
    movs: [
      m('provision', 'ingreso', 'Provisión de fondos', 1000, true, 204, 0, 'clientes'),
      m('perito', 'suplido', 'Informe pericial médico', 800, false, 196, 0, 'clientes'),
      m('procurador', 'suplido', 'Derechos de procurador', 300, false, 150, 0, 'clientes'),
      m('indemnizacion', 'ingreso', 'Indemnización cobrada a la aseguradora', 18_500, true, 42, 0, 'clientes'),
      m('honsal', 'honorario', 'Traspaso de honorarios a la cuenta del despacho', 2420, false, 40, 21, 'clientes'),
      m('entrega', 'otro', 'Entrega del neto de la indemnización al cliente', 15_980, false, 38, 0, 'clientes'),
    ],
    slots: { 0: 'honsal', 1: 'perito', 2: 'procurador', 3: 'provision' },
    facturas: [f('ortega', 'pagada', 40, [['Honorarios reclamación de daños — accidente de tráfico', 2000]])],
    cierre: 35,
  },
  {
    key: 'cuotas-velazquez', titulo: 'Reclamación de cuotas — propietario 4ºB (3.240 €)',
    descripcion: 'Dieciocho meses de cuotas comunitarias impagadas. Acuerdo de junta con certificado de deuda.',
    contactos: [9], plantilla: 'monitorio', inicio: 10, estado: 'en_proceso', prioridad: 'media', vence: 120,
    movs: [
      m('provision', 'ingreso', 'Provisión de fondos', 300, true, 9, 0, 'clientes'),
      m('burofax', 'suplido', 'Burofax al propietario moroso', 30, false, 8, 0, 'clientes'),
    ],
    slots: { 1: 'burofax' },
    facturas: [],
  },
  {
    key: 'rentas-solaz-atocha', titulo: 'Reclamación de rentas local C/ Atocha 80 — Solaz',
    descripcion: 'Local comercial con 6 meses de renta pendientes (7.200 €). El deudor se ha opuesto.',
    contactos: [8], plantilla: 'monitorio', inicio: 50, estado: 'en_proceso', prioridad: 'alta', vence: 80,
    movs: [
      m('hon', 'honorario', 'Honorarios procedimiento monitorio', 726, true, 49, 21, 'operativa'),
      m('burofax', 'suplido', 'Burofax de requerimiento', 30, false, 47, 0, 'clientes'),
    ],
    slots: { 0: 'hon', 1: 'burofax' },
    facturas: [f('solaz-atocha', 'pagada', 49, [['Honorarios monitorio rentas local C/ Atocha 80', 600]])],
  },
];

// ---------------------------------------------------------------------------
// Despacho: gastos generales (algunos con factura recibida) y retiros

export const GENERALES: readonly MovDemo[] = [
  m('alquiler-1', 'gasto', 'Alquiler del despacho — mes anterior', 1452, false, 35, 21, 'operativa'),
  m('alquiler-2', 'gasto', 'Alquiler del despacho — mes en curso', 1452, false, 5, 21, 'operativa'),
  m('editorial', 'gasto', 'Base de datos jurídica — suscripción mensual', 290.4, false, 12, 21, 'operativa'),
  m('colegio', 'gasto', 'Cuota del Colegio de Abogados', 95, false, 20, 0, 'operativa'),
  m('seguro', 'gasto', 'Seguro de responsabilidad civil profesional', 480, false, 60, 0, 'operativa'),
  m('telefonia', 'gasto', 'Telefonía e internet', 72.6, false, 8, 21, 'operativa'),
  m('material', 'gasto', 'Material de oficina', 54.45, false, 3, 21, 'caja', false),
  m('consulta-1', 'ingreso', 'Consulta puntual — arrendamientos', 121, true, 6, 21, 'caja'),
  m('consulta-2', 'ingreso', 'Consulta online — herencias', 60.5, true, 15, 21, 'operativa'),
];

/** Facturas recibidas por key de gasto general. `numero` recibe el ejercicio. */
export const RECIBIDAS: Readonly<Record<string, { proveedor: { nombre: string; nif: string }; numero: (y: number) => string; categoria: string }>> = {
  'alquiler-1': { proveedor: { nombre: 'Gestión Patrimonial Goya S.L.', nif: 'B86123457' }, numero: (y) => `GPG-${y}-0187`, categoria: 'Alquiler' },
  'alquiler-2': { proveedor: { nombre: 'Gestión Patrimonial Goya S.L.', nif: 'B86123457' }, numero: (y) => `GPG-${y}-0213`, categoria: 'Alquiler' },
  editorial: { proveedor: { nombre: 'Editorial Jurídica Iberia S.A.', nif: 'A28123456' }, numero: (y) => `EJI-${y}/04512`, categoria: 'Suscripciones' },
  telefonia: { proveedor: { nombre: 'Telecom Norte S.A.', nif: 'A48123459' }, numero: (y) => `TN${y}-889214`, categoria: 'Suministros' },
  material: { proveedor: { nombre: 'Papelería Centro S.L.', nif: 'B28765432' }, numero: (y) => `PC-${y}-1203`, categoria: 'Material de oficina' },
};

export const RETIROS: readonly { key: string; concepto: string; importe: number; offset: number }[] = [
  { key: '01', concepto: 'Retiro del titular — mes anterior', importe: 2500, offset: -61 },
  { key: '02', concepto: 'Retiro del titular — mes en curso', importe: 2500, offset: -30 },
];

/** Líneas del extracto sin movimiento casado (quedan pendientes de conciliar). */
export const EXTRACTO_SUELTO: Partial<Record<CuentaDemo, readonly { concepto: string; importe: number; offset: number }[]>> = {
  operativa: [
    { concepto: 'COMISION MANTENIMIENTO CUENTA', importe: -15, offset: -10 },
    { concepto: 'TRANSFERENCIA RECIBIDA REF. 4471 — PENDIENTE DE IDENTIFICAR', importe: 240, offset: -2 },
  ],
};

// ---------------------------------------------------------------------------
// Agenda

export interface EventoDemo {
  titulo: string;
  offset: number;
  horas?: readonly [string, string];
  color: EventoColor;
  prioridad: EventoPrioridad;
  estado: EventoEstado;
  lugar?: string;
  link?: string;
  recurrencia?: EventoRecurrencia;
}

/** `offset: 'lunes'` se resuelve al lunes de hace cuatro semanas (reunión recurrente). */
export const EVENTOS: readonly (Omit<EventoDemo, 'offset'> & { offset: number | 'lunes' })[] = [
  { titulo: 'Reunión inicial — herencia García López', offset: -44, horas: ['10:00', '11:00'], color: 'azul', prioridad: 'media', estado: 'completado', lugar: 'Despacho' },
  { titulo: 'Mediación familiar — Dubois', offset: -48, horas: ['17:00', '18:30'], color: 'violeta', prioridad: 'media', estado: 'completado', lugar: 'Centro de mediación, C/ Princesa 3' },
  { titulo: 'Revisión de cartera de impagos con Solaz Inmuebles', offset: -2, horas: ['12:00', '13:00'], color: 'verde', prioridad: 'media', estado: 'completado', lugar: 'Videollamada', link: 'https://meet.example.com/solaz' },
  { titulo: 'Preparación vista — rentas local C/ Atocha 80', offset: 0, horas: ['16:00', '18:00'], color: 'naranja', prioridad: 'alta', estado: 'en_progreso', lugar: 'Despacho' },
  { titulo: 'Reunión con Lucía Fernández — firma de la hoja de encargo', offset: 1, horas: ['17:00', '17:45'], color: 'azul', prioridad: 'media', estado: 'confirmado', lugar: 'Despacho' },
  { titulo: 'Vista verbal — rentas local C/ Atocha 80', offset: 2, horas: ['10:00', '11:00'], color: 'rojo', prioridad: 'alta', estado: 'confirmado', lugar: 'Juzgados de Plaza de Castilla, Madrid' },
  { titulo: 'Llamada con el perito — humedades Pérez Gómez', offset: 3, horas: ['16:00', '16:30'], color: 'naranja', prioridad: 'media', estado: 'tentativo' },
  { titulo: 'Comida con Rosa Jiménez (Solaz Inmuebles)', offset: 8, horas: ['14:00', '15:30'], color: 'verde', prioridad: 'baja', estado: 'confirmado', lugar: 'Restaurante La Castellana' },
  { titulo: 'Plazo: oposición al monitorio Reformas Levante', offset: 9, color: 'amarillo', prioridad: 'alta', estado: 'confirmado' },
  { titulo: 'Vista — modificación de medidas Dubois', offset: 12, horas: ['10:30', '12:00'], color: 'rojo', prioridad: 'alta', estado: 'confirmado', lugar: 'Juzgado de Familia nº 24, Madrid' },
  { titulo: 'Junta de propietarios C/ Velázquez 30', offset: 13, horas: ['19:00', '20:30'], color: 'azul', prioridad: 'media', estado: 'confirmado', lugar: 'Portal C/ Velázquez 30' },
  { titulo: 'Curso: novedades de la Ley de Eficiencia Procesal', offset: 15, horas: ['16:00', '19:00'], color: 'gris', prioridad: 'baja', estado: 'tentativo', lugar: 'Colegio de Abogados' },
  { titulo: 'Firma de escritura de herencia — García López', offset: 16, horas: ['12:00', '13:00'], color: 'violeta', prioridad: 'alta', estado: 'confirmado', lugar: 'Notaría, C/ Velázquez 50' },
  { titulo: 'Lanzamiento C/ Goya 45 — asistencia a la diligencia', offset: 20, horas: ['09:30', '11:00'], color: 'rojo', prioridad: 'alta', estado: 'confirmado', lugar: 'C/ Goya 45, Madrid' },
  { titulo: 'Reunión de equipo semanal', offset: 'lunes', horas: ['09:00', '09:30'], color: 'gris', prioridad: 'ninguna', estado: 'confirmado', recurrencia: 'semanal', lugar: 'Despacho' },
];

// ---------------------------------------------------------------------------
// Acciones, su historial, feed de actividad

export interface AccionDemo {
  key: string;
  nombre: string;
  ambito: AmbitoAccion;
  canales: Canal[];
  asunto: string;
  cuerpo: string;
  plantilla?: string;
  hitoPlantillaId?: string;
}

export const ACCIONES: readonly AccionDemo[] = [
  {
    key: 'bienvenida', nombre: 'Bienvenida al cliente', ambito: 'contacto', canales: ['gmail', 'whatsapp'],
    asunto: 'Bienvenido/a a {{empresa}}',
    cuerpo: 'Hola {{nombre}}:\n\nGracias por confiar en {{empresa}}. Hemos abierto tu expediente sobre "{{asunto}}" y en breve te enviaremos la hoja de encargo.\n\nCualquier duda, responde a este mensaje.\n\nUn saludo.',
  },
  {
    key: 'presupuesto', nombre: 'Envío de presupuesto', ambito: 'contacto', canales: ['gmail', 'outlook'],
    asunto: 'Presupuesto — {{asunto}}',
    cuerpo: 'Hola {{nombre}}:\n\nAdjunto el presupuesto de honorarios para "{{asunto}}". Incluye honorarios, suplidos previstos y forma de pago.\n\nSi estás conforme, te enviamos la hoja de encargo para firmar.\n\nUn saludo,\n{{empresa}}',
  },
  {
    key: 'admision', nombre: 'Informar de la admisión de la demanda', ambito: 'caso', canales: ['gmail', 'whatsapp'],
    plantilla: 'desahucio-impago', hitoPlantillaId: 'hito-04',
    asunto: 'Novedades en tu caso: {{caso}}',
    cuerpo: 'Hola {{nombre}}:\n\nEl juzgado ha admitido a trámite la demanda ({{caso}}). El inquilino tiene 10 días para pagar, desalojar u oponerse.\n\nTe mantenemos informado.\n\n{{empresa}}',
  },
  {
    key: 'documentacion', nombre: 'Solicitud de documentación de la herencia', ambito: 'caso', canales: ['gmail'],
    plantilla: 'herencia-testamentaria', hitoPlantillaId: 'hito-01',
    asunto: 'Documentación necesaria — {{caso}}',
    cuerpo: 'Hola {{nombre}}:\n\nPara avanzar con {{caso}} necesitamos:\n- DNI de todos los herederos\n- Certificado de defunción\n- Escrituras de los inmuebles\n- Extractos bancarios a fecha de fallecimiento\n\nGracias,\n{{empresa}}',
  },
  {
    key: 'recordatorio-pago', nombre: 'Recordatorio de pago de factura', ambito: 'contacto', canales: ['whatsapp', 'gmail'],
    asunto: 'Recordatorio de pago',
    cuerpo: 'Hola {{nombre}}, te recordamos que tienes una factura pendiente con {{empresa}}. Puedes pagarla por transferencia. ¡Gracias!',
  },
];

/** [acción, índice de contacto, key de caso | null, canal, hace días]. */
export const REGISTROS_ACCION: readonly (readonly [string, number, string | null, Canal, number])[] = [
  ['bienvenida', 0, null, 'gmail', 44], ['documentacion', 0, 'herencia-garcia', 'gmail', 43],
  ['bienvenida', 1, null, 'whatsapp', 28], ['admision', 8, 'desahucio-solaz-goya', 'gmail', 58],
  ['recordatorio-pago', 6, null, 'whatsapp', 8], ['presupuesto', 2, null, 'gmail', 6],
  ['bienvenida', 2, null, 'gmail', 5], ['presupuesto', 3, null, 'outlook', 3],
  ['bienvenida', 4, null, 'whatsapp', 2], ['recordatorio-pago', 5, null, 'whatsapp', 2],
];

/** [módulo, frase, hace días, entidad (key de caso, `contacto:N` o null)]. */
export const ACTIVIDAD: readonly (readonly [Modulo, string, number, string | null])[] = [
  ['Casos', 'Creó el caso "Humedades por vicios constructivos — Promociones Alcalá"', 2, 'rc-perez'],
  ['Contactos', 'Creó el contacto "Elena Romero Díaz"', 2, 'contacto:4'],
  ['Casos', 'Creó el caso "Divorcio de mutuo acuerdo Fernández — Ortiz"', 3, 'divorcio-fernandez'],
  ['Facturación', 'Emitió la factura de "Monitorio contra Reformas Levante S.L."', 21, 'monitorio-navarro'],
  ['Tesorería', 'Registró el movimiento "Burofax al propietario moroso" (30 €)', 8, 'cuotas-velazquez'],
  ['Tesorería', 'Registró la factura recibida de Telecom Norte S.A.', 8, null],
  ['Calendario', 'Creó el evento "Vista — modificación de medidas Dubois"', 6, null],
  ['Tesorería', 'Cerró la caja del periodo', 7, null],
  ['Casos', 'Completó el hito "Requerimiento judicial de pago al deudor (20 días)"', 5, 'rentas-solaz-atocha'],
  ['Contactos', 'Cambió el estado de "Antonio Pérez Gómez" a Pendiente de presupuesto', 4, 'contacto:3'],
  ['Tesorería', 'Importó el extracto de la cuenta operativa', 1, null],
  ['Casos', 'Creó el caso "Reclamación de cuotas — propietario 4ºB (3.240 €)"', 10, 'cuotas-velazquez'],
  ['Tesorería', 'Registró el movimiento "Derechos de procurador (demanda)" (180 €)', 12, 'desahucio-martin'],
  ['Configuración', 'Actualizó la plantilla "Desahucio por falta de pago"', 30, null],
  ['Casos', 'Confirmó el cierre del caso "Accidente de tráfico A-6 — Ortega Castro"', 35, 'trafico-ortega'],
  ['Facturación', 'Marcó como pagada la factura de "Accidente de tráfico A-6 — Ortega Castro"', 37, 'trafico-ortega'],
  ['Casos', 'Creó el caso "Herencia de D. Ramón García Ortiz"', 44, 'herencia-garcia'],
];
