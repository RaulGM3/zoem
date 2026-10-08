import type { Guia, RequisitoGuia } from '../guia';

/**
 * La pantalla Acciones exige `permissionGuard('Configuración')`. Lanzarlas, en
 * cambio, vive en Contactos y Casos: esas tareas están en sus propias guías.
 */
const GESTIONAR: RequisitoGuia = { modulo: 'Configuración', capacidad: 'editar' };

export const GUIA_ACCIONES: Guia = {
  id: 'acciones',
  titulo: 'Acciones',
  modulo: 'Configuración',
  ruta: '/acciones',
  resumen:
    'Plantillas de mensaje, con un documento opcional, que se lanzan desde un contacto o un caso y se envían por Gmail, Outlook, el correo del equipo o WhatsApp.',
  paraQue:
    'Dejar de escribir a mano los mismos avisos al cliente: el mensaje se rellena con los datos del contacto o del caso y queda registrado como enviado.',
  aSaber: [
    'Cada acción se ejecuta desde un contacto o desde un caso: lo eliges en "Se ejecuta desde" y no se puede mezclar.',
    'Las variables del asunto y del cuerpo, como {{nombre}}, se sustituyen por los datos reales al lanzar la acción.',
    'Vertey no envía el mensaje por ti: lo prepara y lo abre en Gmail, Outlook, tu app de correo o WhatsApp para que lo revises y lo envíes tú.',
    'El documento adjunto se rellena con los datos del contacto o caso y se envía como un enlace que caduca a los 7 días.',
    'Una acción desactivada deja de aparecer al lanzar acciones, pero no se borra.',
  ],
  claves: ['plantillas de mensaje', 'notificar', 'avisar al cliente', 'correo', 'email', 'whatsapp', 'comunicaciones', 'mensajes'],
  tareas: [
    {
      id: 'crear-accion',
      titulo: 'Crear una acción',
      claves: ['nueva', 'alta', 'plantilla de mensaje', 'presupuesto', 'aviso'],
      requiere: GESTIONAR,
      pasos: [
        'En Acciones, pulsa "Nueva acción".',
        'Escribe el "Nombre", por ejemplo «Enviar presupuesto».',
        'En "Se ejecuta desde", elige "Un contacto" o "Un caso".',
        'Escribe el "Asunto" y el "Cuerpo". Pulsa una variable para insertarla donde tengas el cursor.',
        'Si quieres, elige un "Documento adjunto (opcional)" de tus plantillas de documento.',
        'Marca los "Canales permitidos": Gmail, Outlook, Correo (app por defecto) o WhatsApp. Hace falta al menos uno.',
        'Pulsa "Crear acción".',
      ],
      nota: 'Con "Redactar con IA" explicas qué quieres decir y la IA te propone el asunto y el cuerpo. Revísalos antes de guardar.',
    },
    {
      id: 'editar-accion',
      titulo: 'Editar, activar o desactivar una acción',
      claves: ['modificar', 'cambiar', 'pausar', 'inactiva', 'activa'],
      requiere: GESTIONAR,
      pasos: [
        'En Acciones, pulsa el lápiz "Editar" de la acción, cambia lo que necesites y pulsa "Guardar".',
        'Para dejar de ofrecerla sin borrarla, apaga el interruptor "Activa". Aparece como "Inactiva".',
      ],
    },
    {
      id: 'accion-plantilla-caso',
      titulo: 'Sugerir una acción al completar un hito',
      claves: ['plantilla de caso', 'hito', 'automático', 'sugerencia', 'avisar al cliente'],
      requiere: GESTIONAR,
      pasos: [
        'Abre una plantilla de caso desde "Gestión de Casos" › "Plantillas" y ve a la pestaña "Acciones".',
        'Pulsa "Nueva acción".',
        'En "Sugerir al completar el hito", elige el hito. Con "Ninguno (solo manual)" la acción solo se lanza a mano.',
        'Rellena el mensaje y los canales y pulsa "Crear acción".',
      ],
      nota: 'En los casos creados con esa plantilla, al completar el hito aparece «¿Notificar al cliente que … está listo?» con los botones "Notificar" y "Ahora no". En Acciones se ve marcada como "Ligada a plantilla de caso".',
    },
    {
      id: 'eliminar-accion',
      titulo: 'Eliminar una acción',
      claves: ['borrar', 'quitar'],
      requiere: GESTIONAR,
      pasos: ['En Acciones, pulsa "Eliminar" en la acción.', 'Pulsa "Confirmar".'],
      nota: 'El historial de lo que ya se envió con ella no se borra.',
    },
  ],
};
