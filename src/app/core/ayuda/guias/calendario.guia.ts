import type { Guia } from '../guia';

export const GUIA_CALENDARIO: Guia = {
  id: 'calendario',
  titulo: 'Calendario',
  modulo: 'Calendario',
  ruta: '/calendario',
  resumen: 'La agenda del despacho: los eventos del equipo y los hitos de los casos, por semana o por mes.',
  paraQue:
    'Ver qué toca cada día, programar reuniones y plazos, registrar las horas trabajadas en cada hito y llevar la agenda a tu calendario habitual.',
  claves: ['agenda', 'eventos', 'citas', 'reuniones', 'plazos', 'horario', 'horas'],
  tareas: [
    {
      id: 'crear-evento',
      titulo: 'Crear un evento',
      claves: ['nuevo evento', 'cita', 'reunión', 'programar', 'invitar', 'repetición', 'recurrente'],
      requiere: { modulo: 'Calendario', capacidad: 'crear' },
      pasos: [
        'En Calendario, pulsa "Nuevo evento".',
        'Escribe el "Nombre" y la "Fecha". Marca "Todo el día" o indica "Inicio" y "Fin".',
        'Si se repite, configura la "Repetición" y cuándo "Termina": en una fecha o después de un número de veces.',
        'Opcional: añade "Lugar", "Link (URL)", "Descripción", "Color" y "Prioridad".',
        'En "Invitados", busca a los miembros o marca "Toda la compañía".',
        'Pulsa "Crear evento".',
      ],
    },
    {
      id: 'ver-agenda',
      titulo: 'Cambiar entre vista de semana y de mes',
      claves: ['vista', 'semana', 'mes', 'navegar', 'día'],
      pasos: [
        'Usa los botones "Sem" y "Mes" para cambiar de vista.',
        'Selecciona un día para ver sus eventos e hitos en el horario.',
      ],
    },
    {
      id: 'estado-hito',
      titulo: 'Marcar un hito como en proceso o completado',
      claves: ['completar', 'en proceso', 'revertir', 'avance', 'tarea hecha'],
      requiere: { modulo: 'Calendario', capacidad: 'editar' },
      pasos: [
        'Selecciona el día del hito.',
        'Pulsa "En proceso" o "Completar" en el hito.',
        'Si te equivocas, "Revertir" lo devuelve al estado anterior.',
      ],
    },
    {
      id: 'registrar-horas',
      titulo: 'Registrar las horas trabajadas en un hito',
      claves: ['horas', 'tiempo', 'imputar', 'timesheet', 'bloque', 'facturable'],
      requiere: { modulo: 'Calendario', capacidad: 'editar' },
      pasos: [
        'Selecciona el día y abre el hito en el horario.',
        'En "Horas trabajadas", pulsa "Añadir bloque".',
        'Indica el miembro, la fecha, la hora de inicio y la hora de fin.',
        'Pulsa "Guardar horas".',
      ],
      nota: 'Las horas registradas aparecen después en Facturación, en la pestaña "Registro de Horas".',
    },
    {
      id: 'anotaciones',
      titulo: 'Añadir una anotación a un evento o hito',
      claves: ['nota', 'comentario', 'apunte', 'observación'],
      requiere: { modulo: 'Calendario', capacidad: 'editar' },
      pasos: ['Abre el evento o el hito en el horario.', 'En "Anotaciones", escribe en "Añadir anotación..." y confírmala.'],
    },
    {
      id: 'suscribirse-calendario',
      titulo: 'Ver el calendario en Google Calendar, Outlook o Apple Calendar',
      claves: ['suscribirse', 'sincronizar', 'google calendar', 'outlook', 'apple', 'ical', 'exportar', 'móvil'],
      pasos: [
        'En Calendario, pulsa "Suscribirse".',
        'Copia el "Enlace del calendario" o pulsa "Abrir en Google Calendar".',
        'Añádelo en tu aplicación de calendario con cualquier cuenta de correo.',
      ],
      nota: 'Es de solo lectura y se actualiza solo. "Regenerar" crea un enlace nuevo e invalida el anterior; "Revocar" lo desactiva.',
    },
    {
      id: 'eliminar-evento',
      titulo: 'Eliminar un evento',
      claves: ['borrar', 'cancelar cita', 'quitar'],
      requiere: { modulo: 'Calendario', capacidad: 'eliminar' },
      pasos: ['Abre el evento en el horario.', 'Pulsa "Eliminar evento" y confirma con "Eliminar".'],
      nota: 'Esta acción no se puede deshacer.',
    },
  ],
};
