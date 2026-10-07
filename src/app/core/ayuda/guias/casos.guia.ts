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
  resumen: 'Los expedientes del despacho: cada caso reúne sus clientes, hitos, movimientos de dinero y documentos.',
  paraQue:
    'Seguir cada asunto de principio a fin: qué hay que hacer y cuándo, cuánto se ha cobrado y gastado, y qué documentos faltan.',
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
      id: 'plazos-procesales-beta',
      titulo: 'Calcular un plazo procesal (BETA)',
      claves: ['plazo', 'plazos procesales', 'vencimiento', 'lexnet', 'notificación', 'días inhábiles', 'agosto', 'cómputo', 'partido judicial'],
      requiere: { modulo: 'Casos', capacidad: 'editar' },
      pasos: [
        'Abre el caso, pulsa "Editar" y rellena "Jurisdicción" y "Partido judicial" (y, si quieres, "Órgano judicial" y "Nº de procedimiento"). Después pulsa "Guardar".',
        'En el bloque "Plazos procesales" de la pestaña "Información", pulsa "Nuevo plazo".',
        'Indica la "Fecha de notificación", elige un "Tipo de plazo" (solo es una sugerencia) y ajusta "Cantidad" y "Unidad" si hace falta.',
        'Revisa el vencimiento calculado y el día de gracia (hasta las 15:00 del siguiente día hábil).',
        'En "Días inhábiles en este plazo", desmarca los días que en realidad sean hábiles; el vencimiento se recalcula al momento. Lee también los avisos.',
        'Marca "He revisado los días inhábiles y el vencimiento resultante" y pulsa "Guardar plazo": se crea un evento en el calendario.',
      ],
      nota: 'Función en pruebas: el cálculo es orientativo y la responsabilidad del cómputo es del profesional. Solo cuentan los días inhábiles confirmados en Configuración. Si cambian, el plazo pasa a "Requiere revisión" y tú decides si aceptas el nuevo vencimiento con "Revisar"; nunca se modifica solo.',
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
        'Muévete por las pestañas "Datos básicos", "Hitos", "Estructura de costos" y "Documentos de referencia".',
        'Para borrarla, pulsa "Eliminar plantilla" en su tarjeta.',
      ],
    },
  ],
};
