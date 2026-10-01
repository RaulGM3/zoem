import type { Guia } from '../guia';

export const GUIA_CONTACTOS: Guia = {
  id: 'contactos',
  titulo: 'Contactos',
  modulo: 'Contactos',
  ruta: '/contactos',
  resumen: 'El CRM del despacho: clientes y contactos, personas físicas o jurídicas, con su estado y sus seguimientos.',
  paraQue:
    'Tener a cada cliente con sus datos, saber en qué fase está y qué le debe entregar el despacho, y llegar desde él a sus casos, facturas y documentos.',
  claves: ['crm', 'clientes', 'personas', 'empresas', 'leads'],
  tareas: [
    {
      id: 'crear-contacto',
      titulo: 'Crear un contacto',
      claves: ['nuevo', 'alta', 'añadir', 'cliente', 'persona física', 'persona jurídica', 'empresa', 'nif', 'dni', 'documento'],
      requiere: { modulo: 'Contactos', capacidad: 'crear' },
      pasos: [
        'En Contactos, pulsa "Nuevo Contacto".',
        'Elige el "Tipo de contacto": Persona Física o Persona Jurídica.',
        'Rellena los datos principales: "Nombre" y "Apellidos" para una persona física, o "Razón social" para una jurídica.',
        'Si lo tienes, elige el "Tipo de documento" (DNI, NIE, Pasaporte u Otro para una persona física; NIF (España), VAT (UE) u Otro para una jurídica) y escribe el "Número de documento". Es opcional, pero un DNI, NIE o NIF inválido no te deja continuar: revisa los números y la letra.',
        'En "Datos de contacto", indica al menos un email o un móvil.',
        'Pulsa "Continuar". La "Info adicional" es opcional: estado, asunto, canal de entrada, a quién se asigna y notas internas.',
        'Pulsa "Guardar contacto".',
      ],
      nota: 'Vertey guarda los documentos españoles normalizados (mayúsculas, sin espacios ni guiones) y no valida pasaportes, VAT ni otros documentos. Al guardar, Vertey puede pedirte el "Próximo paso" (qué hay que entregar y para cuándo). Puedes programarlo o pulsar "Omitir".',
    },
    {
      id: 'importar-contactos',
      titulo: 'Importar contactos desde Excel',
      claves: ['excel', 'csv', 'xlsx', 'cargar', 'masivo', 'migrar', 'importación'],
      requiere: { modulo: 'Contactos', capacidad: 'crear' },
      pasos: [
        'En Contactos, pulsa "Importar Excel".',
        'Arrastra el archivo o haz clic para seleccionarlo. Admite .xlsx, .xls y .csv, y la primera fila debe tener los encabezados de columna.',
        'En "Mapeo de columnas", asigna cada columna a su campo. Hace falta un canal de contacto (Email o Teléfono) y, además, Nombre y Apellidos para personas físicas o Razón Social para personas jurídicas.',
        'Si el archivo trae una columna "Responsable", asigna cada nombre al usuario que corresponda, o déjalo sin asignar.',
        'Revisa la vista previa y pulsa el botón "Importar".',
      ],
      nota: 'Las filas sin canal de contacto o con campos obligatorios vacíos se saltan; Vertey te dice cuántas antes de importar.',
    },
    {
      id: 'buscar-contacto',
      titulo: 'Buscar y filtrar contactos',
      claves: ['encontrar', 'filtro', 'estado', 'tipo', 'localizar'],
      pasos: [
        'Usa "Filtrar por estado" y "Filtrar por tipo" para acotar la lista.',
        'Para buscar por nombre, teléfono o email, usa la barra superior "¿Qué quieres buscar?" con la categoría Contactos.',
        'Pulsa un contacto para abrir su ficha.',
      ],
    },
    {
      id: 'cambiar-estado',
      titulo: 'Cambiar el estado de un contacto y programar un seguimiento',
      claves: ['fase', 'pipeline', 'potencial', 'activo', 'seguimiento', 'compromiso', 'próximo paso', 'pendiente'],
      requiere: { modulo: 'Contactos', capacidad: 'editar' },
      pasos: [
        'Pulsa el chip de estado del contacto, en la lista o en su ficha.',
        'En "Cambiar estado", elige el estado nuevo. El que tiene ahora aparece marcado como "Actual".',
        'En "Próximo paso", escribe "Qué hay que entregar", la "Fecha límite" y el "Responsable".',
        'Pulsa "Guardar y programar". Si no quieres crear un seguimiento, pulsa "Omitir".',
      ],
      nota: 'El seguimiento crea un evento en el calendario del responsable y aparece en su panel, en "Mis seguimientos pendientes".',
    },
    {
      id: 'editar-contacto',
      titulo: 'Editar los datos de un contacto',
      claves: ['modificar', 'corregir', 'actualizar', 'cambiar datos'],
      requiere: { modulo: 'Contactos', capacidad: 'editar' },
      pasos: [
        'En la lista pulsa "Editar contacto", o abre la ficha y pulsa "Editar".',
        'Cambia lo que necesites.',
        'Pulsa "Guardar cambios".',
      ],
    },
    {
      id: 'ficha-contacto',
      titulo: 'Ver los casos, las facturas y los seguimientos de un contacto',
      claves: ['ficha', 'detalle', 'historial', 'facturado', 'notas'],
      pasos: [
        'Abre el contacto desde la lista.',
        'La ficha muestra el total facturado, sus casos, sus facturas y sus seguimientos.',
        'Cuando un seguimiento esté hecho, pulsa "Completar".',
        'En "Notas" puedes escribir apuntes sobre el contacto.',
      ],
    },
    {
      id: 'documentos-contacto',
      titulo: 'Guardar documentos de un contacto',
      claves: ['archivos', 'carpetas', 'subir', 'adjuntar', 'pdf'],
      requiere: { modulo: 'Contactos', capacidad: 'crear' },
      pasos: [
        'Abre la ficha del contacto y ve a "Documentos".',
        'Pulsa "Nueva carpeta" para organizar, o "Subir archivo" para añadir un documento.',
        'Entra en una carpeta pulsándola; la ruta de carpetas te permite volver a "Raíz".',
      ],
    },
    {
      id: 'abrir-caso-desde-contacto',
      titulo: 'Abrir un caso para un contacto',
      claves: ['nuevo caso', 'expediente', 'crear caso'],
      requiere: { modulo: 'Casos', capacidad: 'crear' },
      pasos: [
        'En la lista de contactos, pulsa "Abrir caso para este contacto".',
        'Se abre el formulario de caso nuevo con ese cliente ya seleccionado. Complétalo y pulsa "Crear caso".',
      ],
    },
    {
      id: 'eliminar-contacto',
      titulo: 'Eliminar un contacto',
      claves: ['borrar', 'quitar', 'dar de baja'],
      requiere: { modulo: 'Contactos', capacidad: 'eliminar' },
      pasos: ['En la lista, pulsa "Eliminar contacto".', 'Pulsa "Confirmar eliminación".'],
    },
  ],
};
