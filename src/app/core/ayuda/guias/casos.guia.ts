import type { Guia, RequisitoGuia } from '../guia';

/**
 * Las plantillas de caso se abren desde Casos, pero sus rutas exigen el módulo
 * Configuración (`permissionGuard('Configuración')`). Sin este requisito la
 * ayuda mandaría a un usuario a una pantalla que le responde "sin acceso".
 */
const PLANTILLAS: RequisitoGuia = { modulo: 'Configuración', capacidad: 'ver' };

export const GUIA_CASOS: Guia = {
  id: 'casos',
  titulo: 'Casos',
  modulo: 'Casos',
  ruta: '/casos',
  otrasRutas: ['/plantillas'],
  resumen: 'Los expedientes del despacho: cada caso reúne sus clientes, hitos, movimientos de dinero y documentos.',
  paraQue:
    'Seguir cada asunto de principio a fin: qué hay que hacer y cuándo, cuánto se ha cobrado y gastado, y qué documentos faltan.',
  aSaber: [
    'Un caso necesita al menos un cliente y un título.',
    'Si lo creas desde una plantilla, se copian sus hitos, sus documentos requeridos y sus acciones sugeridas.',
    'Los cobros y gastos del caso se registran en su pestaña "Gestoría" y llegan solos a Facturación y Tesorería.',
    'Con "Notificar / Acciones" envías al cliente mensajes ya redactados; cada envío queda en "Acciones enviadas".',
    'Al completar ciertos hitos, Vertey te sugiere avisar al cliente. Nunca envía nada sin que lo confirmes.',
  ],
  claves: ['expedientes', 'asuntos', 'plazos', 'vencimientos', 'seguimiento'],
  tareas: [
    {
      id: 'crear-caso',
      titulo: 'Crear un caso nuevo',
      claves: ['nuevo', 'alta', 'abrir expediente', 'añadir caso'],
      requiere: { modulo: 'Casos', capacidad: 'crear' },
      pasos: [
        'En "Gestión de Casos", pulsa "Nuevo caso".',
        'En "Cliente", busca por nombre, DNI, email o teléfono y selecciónalo. Si no existe, pulsa "Crear nuevo cliente".',
        'Escribe el "Título". Es obligatorio.',
        'Si quieres partir de un modelo, elige una "Plantilla": los hitos y la estructura de documentos requeridos se copian automáticamente.',
        'Completa "Encargado principal", "Descripción", "Prioridad", "Estado" y "Vencimiento" si los necesitas.',
        'Pulsa "Crear caso".',
      ],
      nota: 'Hacen falta un cliente y un título para poder crear el caso.',
    },
    {
      id: 'buscar-caso',
      titulo: 'Buscar y filtrar casos',
      claves: ['encontrar', 'filtro', 'estado', 'tipo', 'localizar', 'listado'],
      pasos: [
        'Usa "Filtrar por estado" y "Filtrar por tipo" para acotar la tabla.',
        'Para buscar por título o descripción, usa la barra superior "¿Qué quieres buscar?" con la categoría Casos.',
        'Pulsa un caso de la tabla para abrirlo.',
      ],
    },
    {
      id: 'editar-caso',
      titulo: 'Editar los datos de un caso',
      claves: ['modificar', 'cambiar estado', 'prioridad', 'vencimiento', 'cerrar caso', 'título'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Abre el caso y pulsa "Editar".',
        'Cambia "Título", "Descripción", "Tipo", "Estado", "Prioridad" o "Vencimiento".',
        'Pulsa "Guardar".',
      ],
    },
    {
      id: 'clientes-del-caso',
      titulo: 'Vincular o quitar clientes de un caso',
      claves: ['añadir cliente', 'desvincular', 'contacto', 'parte'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Abre el caso y quédate en la pestaña "Información".',
        'En "Clientes vinculados", escribe en "Buscar y añadir cliente..." y selecciona el contacto.',
        'Para quitar uno, pulsa "Quitar cliente" y confirma con "Quitar".',
      ],
      nota: 'Quitar un cliente solo lo desvincula del caso; el contacto no se elimina.',
    },
    {
      id: 'hitos-del-caso',
      titulo: 'Añadir hitos para seguir el avance del caso',
      claves: ['tareas', 'etapas', 'progreso', 'plazo', 'responsable', 'horas'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Abre el caso y ve a la pestaña "Hitos".',
        'Pulsa "Añadir hito".',
        'Rellena "Título", "Descripción", "Estado", "Fecha estimada" y "Responsables".',
        'Pulsa "Añadir". El "Progreso general" se actualiza según los hitos completados.',
      ],
      nota: 'Cada responsable puede registrar sus horas por separado. Con "Ver actividad" consultas el historial del caso.',
    },
    {
      id: 'movimientos-del-caso',
      titulo: 'Registrar un cobro o un gasto del caso',
      claves: ['movimiento', 'ingreso', 'egreso', 'honorarios', 'suplido', 'provisión de fondos', 'pago', 'gestoría', 'iva'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Abre el caso y ve a la pestaña "Gestoría".',
        'En "Movimientos", pulsa "Añadir".',
        'Rellena "Concepto", "Tipo" e "IVA".',
        'En "Dirección", elige "Entrada (cobrado)" o "Salida (pagado)".',
        'Indica la "Fecha" y la "Cuenta / Caja".',
        'Pulsa "Guardar".',
      ],
      nota: 'La pestaña muestra los ingresos, los egresos, el saldo neto y el IVA del caso. Con "Filtros" acotas por tipo, dirección, cuenta y fechas.',
    },
    {
      id: 'documentos-del-caso',
      titulo: 'Subir y organizar los documentos de un caso',
      claves: ['archivos', 'carpetas', 'adjuntar', 'pdf', 'checklist', 'documentos requeridos'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Abre el caso y ve a la pestaña "Documentos".',
        'Pulsa "Carpeta" para crear una carpeta, o "Subir archivos" y "Subir carpeta" para añadir documentos.',
        'Si el caso salió de una plantilla, "Documentos requeridos" lista lo que falta: pulsa "Subir" en cada uno.',
      ],
      nota: 'En cada archivo puedes previsualizar, descargar, subir una nueva versión, ver el historial y gestionar quién tiene acceso.',
    },
    {
      id: 'notificar-caso',
      titulo: 'Notificar al cliente o lanzar una acción desde un caso',
      claves: ['acciones', 'avisar', 'mensaje', 'correo', 'email', 'whatsapp', 'enviar documento', 'comunicación'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Abre el caso y pulsa "Notificar / Acciones", o elige una de las "Acciones disponibles" en la pestaña "Información".',
        'Si el caso tiene varios clientes, marca los "Destinatarios". Si quieres, asocia el envío a un "Hito".',
        'Repasa el "Asunto" y el "Mensaje": ya vienen rellenos con los datos del caso y del cliente.',
        'En "Enviar por", elige el canal y pulsa "Preparar mensaje".',
        'Pulsa "Abrir en …" para revisarlo en Gmail, Outlook, tu correo o WhatsApp y envíalo desde allí. También puedes usar "Copiar texto".',
      ],
      nota: 'Cada acción muestra si está "Sin enviar" o cuántas veces se ha "Enviada" y cuándo fue la última. Debajo, "Acciones enviadas" guarda el historial. Las acciones se crean en la pantalla Acciones.',
    },
    {
      id: 'sugerencia-hito',
      titulo: 'Avisar al cliente cuando se completa un hito',
      claves: ['sugerencia', 'notificar', 'hito completado', 'listo', 'avisar'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Completa un hito que tenga una acción sugerida en su plantilla.',
        'Arriba del caso aparece «¿Notificar al cliente que … está listo?».',
        'Pulsa "Notificar" para abrir la acción ya preparada, o "Ahora no" para descartarla.',
      ],
    },
    {
      id: 'eliminar-caso',
      titulo: 'Eliminar un caso',
      claves: ['borrar', 'quitar', 'dar de baja'],
      requiere: { modulo: 'Casos', capacidad: 'eliminar' },
      pasos: [
        'En la tabla de casos, pulsa "Más acciones" en la fila del caso.',
        'Pulsa "Eliminar".',
        'Confirma en el diálogo "Eliminar caso".',
      ],
      nota: 'Esta acción no se puede deshacer.',
    },
    {
      id: 'crear-plantilla-caso',
      titulo: 'Crear una plantilla de caso',
      claves: ['plantilla', 'modelo', 'reutilizar', 'estandarizar', 'tipo de caso', 'hitos predefinidos', 'costos'],
      requiere: PLANTILLAS,
      pasos: [
        'En "Gestión de Casos", pulsa "Plantillas".',
        'En "Plantillas de caso", pulsa "Nueva plantilla".',
        'En "Datos básicos", escribe el "Nombre" y, si quieres, el "Tipo", los "Honorarios base" y la "Descripción".',
        'En "Hitos", pulsa "Añadir hito" e indica "Título", "Días desde inicio" y "Asignado a".',
        'En "Estructura de Costos", pulsa "Añadir partida" con su "Tipo" y su precio aproximado.',
        'En "Documentos de referencia", crea carpetas y añade los nombres de los documentos requeridos.',
        'Pulsa "Crear plantilla".',
      ],
      nota: 'Una plantilla es un modelo reutilizable: al crear un caso con ella se copian sus hitos y sus documentos requeridos.',
    },
    {
      id: 'editar-plantilla-caso',
      titulo: 'Editar o eliminar una plantilla de caso',
      claves: ['plantilla', 'modificar modelo', 'borrar plantilla'],
      requiere: PLANTILLAS,
      pasos: [
        'En "Gestión de Casos", pulsa "Plantillas".',
        'Pulsa "Abrir plantilla" en la que quieras cambiar.',
        'Muévete por las pestañas "Datos básicos", "Hitos", "Estructura de costos", "Documentos de referencia" y "Acciones".',
        'Para borrarla, pulsa "Eliminar plantilla" en su tarjeta.',
      ],
    },
  ],
};
