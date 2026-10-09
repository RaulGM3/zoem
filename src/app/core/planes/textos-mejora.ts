import type { Funcion, PlanId } from './catalogo';

export interface TextoMejora {
  titulo: string;
  descripcion: string;
  beneficios: readonly string[];
}

const TEXTOS: Partial<Record<Funcion, TextoMejora>> = {
  facturacion: {
    titulo: 'Facturación',
    descripcion: 'Emite facturas conformes a la normativa y envíalas a la AEAT sin salir de Zoem.',
    beneficios: ['Facturas y rectificativas con numeración automática', 'Envío Verifactu a la AEAT', 'Cobros y estados al día en cada caso'],
  },
  tesoreria: {
    titulo: 'Tesorería',
    descripcion: 'Controla cobros, pagos y el saldo real de tu despacho en un solo lugar.',
    beneficios: ['Cierre de caja y conciliación del saldo bancario', 'Facturas recibidas y gastos', 'Visión de lo pendiente de cobro'],
  },
  recepcionIA: {
    titulo: 'Recepción IA y llamadas',
    descripcion: 'Un asistente atiende, clasifica y resume las consultas de tus clientes.',
    beneficios: ['Atención de llamadas y mensajes', 'Resúmenes y clasificación automática', 'Los contactos se crean solos'],
  },
  informes: {
    titulo: 'Informes',
    descripcion: 'Analiza la actividad y la rentabilidad del despacho con informes listos para usar.',
    beneficios: ['Actividad por caso y por persona', 'Rentabilidad y evolución', 'Exportación para tu gestor'],
  },
  agenteIA: {
    titulo: 'Agente IA',
    descripcion: 'Un agente que trabaja con tus casos, documentos y plazos para ahorrarte tareas repetitivas.',
    beneficios: ['Consulta tus casos en lenguaje natural', 'Redacta y revisa documentos', 'Prepara tareas y recordatorios'],
  },
  ia: {
    titulo: 'IA del despacho',
    descripcion: 'Has agotado el cupo mensual de IA de tu plan. Se renueva cada mes.',
    beneficios: ['Más mensajes de IA al mes', 'Agente IA y Recepción IA', 'Dictado, extracción de documentos y redacción'],
  },
  usuariosMultiples: {
    titulo: 'Más usuarios',
    descripcion: 'Invita a tu equipo para trabajar juntos sobre los mismos casos.',
    beneficios: ['Invitaciones por email', 'Roles y permisos por persona', 'Actividad compartida'],
  },
  rolesPersonalizados: {
    titulo: 'Roles personalizados',
    descripcion: 'Define exactamente qué puede ver y hacer cada miembro del equipo.',
    beneficios: ['Roles a medida', 'Permisos por módulo', 'Excepciones por persona'],
  },
};

const GENERICO: TextoMejora = {
  titulo: 'Función de pago',
  descripcion: 'Esta función no está incluida en tu plan actual.',
  beneficios: ['Mejora tu plan para desbloquearla'],
};

export function textosMejora(f: Funcion): TextoMejora {
  return TEXTOS[f] ?? GENERICO;
}

export interface PlanInfo {
  id: Extract<PlanId, 'free' | 'pro' | 'enterprise'>;
  nombre: string;
  resumen: string;
  puntos: readonly string[];
}

export const PLANES_INFO: readonly PlanInfo[] = [
  {
    id: 'free',
    nombre: 'Free',
    resumen: 'Para abogados independientes',
    puntos: ['1 usuario', 'Contactos, casos, calendario y plazos', 'Documentos y 5 plantillas', '15 acciones al mes'],
  },
  {
    id: 'pro',
    nombre: 'Pro',
    resumen: 'Para despachos que crecen',
    puntos: ['Facturación y tesorería', 'Recepción IA y Agente IA', 'Informes y equipo', 'Cupos generosos'],
  },
  {
    id: 'enterprise',
    nombre: 'Enterprise',
    resumen: 'A medida',
    puntos: ['Todo ilimitado', 'Soporte prioritario', 'Condiciones personalizadas'],
  },
];
