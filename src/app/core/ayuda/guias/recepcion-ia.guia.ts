import type { Guia } from '../guia';

export const GUIA_RECEPCION_IA: Guia = {
  id: 'recepcion-ia',
  titulo: 'Recepción IA',
  modulo: 'RecepciónIA',
  ruta: '/recepcion-ia',
  resumen: 'El asistente que atiende y cualifica las llamadas del despacho, con su transcripción y un resumen de cada una.',
  paraQue:
    'No perder ninguna llamada: ver quién llamó y para qué, y convertirla en un contacto o en un caso sin volver a teclear los datos.',
  aSaber: [
    'Cada llamada llega con su transcripción y un resumen.',
    'Las llamadas de alguien que ya está en el CRM aparecen como "Contacto registrado".',
    'Puedes convertir una llamada en un contacto o en un caso sin volver a escribir los datos.',
  ],
  claves: ['llamadas', 'teléfono', 'recepcionista', 'leads', 'transcripción', 'atención telefónica'],
  tareas: [
    {
      id: 'revisar-llamadas',
      titulo: 'Revisar las llamadas recibidas',
      claves: ['listado', 'historial', 'urgentes', 'filtrar', 'buscar llamada'],
      pasos: [
        'En Recepción IA ves el total de llamadas, las urgentes y la duración media.',
        'Filtra por estado: "Completada", "Fallida" o "Interrumpida".',
        'Busca por nombre, descripción o resumen en "Buscar por nombre, descripción o resumen...".',
      ],
    },
    {
      id: 'ver-transcripcion',
      titulo: 'Leer la transcripción y el resumen de una llamada',
      claves: ['transcripción', 'resumen', 'qué dijo', 'conversación'],
      pasos: ['En la llamada, pulsa "Ver transcripción".', 'Arriba tienes el "Resumen IA" y debajo la conversación completa, turno a turno.'],
    },
    {
      id: 'llamada-a-contacto',
      titulo: 'Convertir una llamada en un contacto',
      claves: ['agregar contacto', 'asociar', 'vincular', 'nuevo cliente', 'lead'],
      requiere: { modulo: 'RecepciónIA', capacidad: 'editar' },
      pasos: [
        'Si quien llamó es nuevo, pulsa "Agregar contacto" en la llamada.',
        'Si ya existe en el CRM, pulsa "Asociar a contacto", búscalo por nombre, email o teléfono y selecciónalo.',
      ],
      nota: 'Las llamadas de alguien que ya está en el CRM aparecen marcadas como "Contacto registrado".',
    },
    {
      id: 'llamada-a-caso',
      titulo: 'Abrir un caso a partir de una llamada',
      claves: ['abrir caso', 'nuevo expediente', 'convertir en caso'],
      requiere: { modulo: 'Casos', capacidad: 'crear' },
      pasos: ['En la llamada, pulsa "Abrir caso".', 'Completa el formulario de caso nuevo y pulsa "Crear caso".'],
    },
    {
      id: 'descartar-llamada',
      titulo: 'Descartar una llamada que no interesa',
      claves: ['quitar', 'ignorar', 'spam', 'eliminar llamada'],
      requiere: { modulo: 'RecepciónIA', capacidad: 'editar' },
      pasos: ['En la llamada, pulsa "Descartar".'],
    },
  ],
};
