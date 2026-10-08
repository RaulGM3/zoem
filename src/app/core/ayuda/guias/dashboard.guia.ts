import type { Guia } from '../guia';

export const GUIA_DASHBOARD: Guia = {
  id: 'dashboard',
  titulo: 'Dashboard',
  modulo: null,
  ruta: '/',
  resumen: 'La pantalla de inicio: un resumen del despacho con el dinero, las llamadas, tus seguimientos y la agenda.',
  paraQue: 'Saber en un vistazo cómo va el despacho y qué tienes pendiente hoy, sin entrar pantalla por pantalla.',
  aSaber: [
    'Es un resumen: pulsa cualquier bloque para ir al detalle.',
    'Tus seguimientos pendientes salen de los "Próximo paso" programados al cambiar el estado de un contacto.',
    'Cada persona ve solo los datos de los módulos que su rol puede ver.',
  ],
  claves: ['inicio', 'panel', 'resumen', 'home', 'portada', 'indicadores'],
  tareas: [
    {
      id: 'leer-dashboard',
      titulo: 'Entender qué muestra el Dashboard',
      claves: ['bloques', 'gráficos', 'qué es', 'secciones'],
      pasos: [
        '"Cuentas bancarias" y "Últimos movimientos" resumen la tesorería.',
        '"Honorarios (últimos 6 meses)", "Ingresos vs Egresos" y "Distribución por tipo" muestran la evolución del dinero.',
        '"Recepción IA" lista las últimas llamadas atendidas.',
        '"Mis seguimientos pendientes" y "Próxima agenda" son lo que tienes por delante.',
        '"Actividad reciente" recoge los últimos cambios del equipo.',
      ],
    },
    {
      id: 'seguimientos-pendientes',
      titulo: 'Ver tus seguimientos pendientes',
      claves: ['compromisos', 'pendientes', 'vencidos', 'tareas', 'qué tengo que hacer'],
      pasos: [
        'En el Dashboard, busca "Mis seguimientos pendientes".',
        'Cada uno es un compromiso con un contacto: qué hay que entregar y hasta cuándo. Los vencidos aparecen destacados.',
      ],
      nota: 'Los seguimientos nacen al cambiar el estado de un contacto y programar el "Próximo paso".',
    },
    {
      id: 'ir-al-detalle',
      titulo: 'Pasar del resumen al detalle',
      claves: ['ver todo', 'enlaces', 'ir a', 'abrir'],
      pasos: [
        'Cada bloque tiene un enlace a su pantalla: "Tesorería →", "Ver todo →", "Ver todos →" y "Calendario →".',
        'Púlsalo para abrir la pantalla completa.',
      ],
    },
  ],
};
