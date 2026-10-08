import type { Guia } from '../guia';

export const GUIA_DOCUMENTOS: Guia = {
  id: 'documentos',
  titulo: 'Documentos',
  modulo: 'Documentos',
  ruta: '/documentos',
  resumen:
    'Plantillas de documentos: subes un escrito, la IA detecta los datos que cambian y después generas versiones nuevas en segundos.',
  paraQue:
    'Dejar de reescribir los mismos escritos: contratos, hojas de encargo o demandas se rellenan con los datos de cada cliente.',
  aSaber: [
    'Una plantilla de documento nace de un PDF o un Word: la IA detecta los datos que cambian y los convierte en variables.',
    'Revisa siempre las variables detectadas antes de generar documentos.',
    'Estas plantillas también se pueden adjuntar a las Acciones para enviarlas rellenas al cliente.',
  ],
  claves: ['plantillas de documentos', 'escritos', 'contratos', 'word', 'pdf', 'variables', 'generar documento'],
  tareas: [
    {
      id: 'crear-plantilla-documento',
      titulo: 'Crear una plantilla de documento a partir de un PDF o Word',
      claves: ['nueva plantilla', 'subir documento', 'analizar con ia', 'modelo', 'docx'],
      requiere: { modulo: 'Documentos', capacidad: 'crear' },
      pasos: [
        'En "Plantillas de documentos", pulsa "Nueva Plantilla".',
        'Escribe el "Nombre" y la "Descripción".',
        'Arrastra un PDF o Word (.docx), o haz clic para seleccionarlo. El máximo son 15MB.',
        'Pulsa "Analizar con IA" y espera a que detecte los datos variables.',
        'Revisa las etiquetas y los tipos de las variables detectadas, y marca las que sean obligatorias.',
        'Pulsa "Guardar plantilla".',
      ],
      nota: 'Si el documento no se puede procesar, pulsa "Intentar de nuevo" o "Volver" para cambiar el archivo.',
    },
    {
      id: 'generar-documento',
      titulo: 'Generar un documento a partir de una plantilla',
      claves: ['rellenar', 'crear escrito', 'descargar', 'docx', 'usar plantilla'],
      pasos: [
        'En "Plantillas de documentos", pulsa la plantilla o su botón "Generar documento".',
        'En "Datos del documento", rellena los campos. Vertey avisa de cuántos obligatorios faltan.',
        'Comprueba el resultado en "Vista previa".',
        'Pulsa "Descargar .docx".',
      ],
    },
    {
      id: 'editar-variables',
      titulo: 'Añadir o quitar variables de una plantilla',
      claves: ['variable', 'campo', 'modo edición', 'hacer estático', 'marcador'],
      requiere: { modulo: 'Documentos', capacidad: 'editar' },
      pasos: [
        'Abre la plantilla y activa el modo edición.',
        'Para crear una variable, selecciona texto en el documento y conviértelo en variable indicando su clave y su etiqueta.',
        'Para fijar un dato, pulsa "Hacer estático" en un campo: su valor queda incrustado en el documento y la variable desaparece del formulario.',
      ],
    },
    {
      id: 'buscar-plantilla-documento',
      titulo: 'Buscar una plantilla de documento',
      claves: ['encontrar', 'localizar', 'filtrar'],
      pasos: ['Escribe en "Buscar plantillas...".', 'Pulsa la plantilla para abrirla.'],
    },
    {
      id: 'eliminar-plantilla-documento',
      titulo: 'Eliminar una plantilla de documento',
      claves: ['borrar', 'quitar'],
      requiere: { modulo: 'Documentos', capacidad: 'eliminar' },
      pasos: ['En la lista, pulsa "Eliminar plantilla".', 'Confirma con "Sí".'],
    },
  ],
};
