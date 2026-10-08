import type { Guia } from '../guia';

export const GUIA_GENERAL: Guia = {
  id: 'general',
  titulo: 'Primeros pasos',
  modulo: null,
  ruta: '/',
  resumen: 'Cómo moverte por Vertey: el menú lateral, la búsqueda global y el asistente.',
  paraQue: 'Orientarte el primer día y saber dónde está cada cosa antes de entrar en detalle.',
  aSaber: [
    'En el menú solo aparecen las pantallas que tu rol puede ver; si te falta alguna, pide acceso al administrador.',
    'La barra de búsqueda de arriba busca contactos, casos o personas del equipo: elige primero la categoría.',
    'El icono de ayuda de la barra superior te explica la pantalla en la que estás.',
    'El asistente Vertey IA está siempre disponible en el botón flotante.',
  ],
  claves: ['empezar', 'inicio', 'menú', 'navegación', 'orientación', 'básico'],
  tareas: [
    {
      id: 'menu-lateral',
      titulo: 'Moverte por el menú lateral',
      claves: ['sidebar', 'secciones', 'pantallas', 'navegar'],
      pasos: [
        'El menú lateral agrupa las pantallas en Principal, Inteligencia Artificial, Gestión, Finanzas y Configuración.',
        'Pulsa una entrada para abrir esa pantalla.',
        'Para ganar espacio, pulsa "Colapsar menú"; con "Expandir menú" vuelve a su tamaño.',
      ],
      nota: 'Solo aparecen las pantallas que tu rol puede ver. Si te falta alguna, pídele acceso al administrador de tu despacho.',
    },
    {
      id: 'busqueda-global',
      titulo: 'Buscar un contacto, un caso o una persona del equipo',
      claves: ['buscador', 'encontrar', 'localizar', 'búsqueda global'],
      pasos: [
        'Pulsa la barra superior "¿Qué quieres buscar?".',
        'Elige dónde buscar: Contactos, Casos o Personal. Vertey te lleva a esa pantalla.',
        'Escribe el texto. Contactos y Personal buscan por nombre, teléfono o email; Casos busca por título o descripción.',
        'Para quitar el filtro, pulsa "Limpiar búsqueda".',
      ],
    },
    {
      id: 'preguntar-asistente',
      titulo: 'Pedir ayuda al asistente Vertey IA',
      claves: ['agente', 'chat', 'ia', 'preguntar', 'asistente', 'dictar'],
      pasos: [
        'Pulsa el botón flotante "Abrir el asistente Vertey IA", disponible en todas las pantallas.',
        'Escribe tu pregunta en "Escribe tu pregunta..." o elige una de las sugerencias.',
        'Pulsa Enter para enviar. Con Shift + Enter añades un salto de línea y con el micrófono puedes dictar.',
      ],
      nota: 'El asistente puede explicarte cómo se hace una tarea, buscar contactos y casos, y llevarte a una pantalla.',
    },
    {
      id: 'modo-oscuro',
      titulo: 'Cambiar entre modo claro y modo oscuro',
      claves: ['tema', 'dark', 'apariencia', 'colores'],
      pasos: ['En la barra superior, pulsa el botón "Cambiar a modo oscuro" o "Cambiar a modo claro".'],
    },
    {
      id: 'cerrar-sesion',
      titulo: 'Cerrar sesión',
      claves: ['salir', 'logout', 'desconectar'],
      pasos: [
        'En el menú lateral, pulsa "Cerrar Sesión".',
        'Confirma con "Cerrar sesión". Tendrás que volver a iniciarla para entrar.',
      ],
    },
  ],
};
