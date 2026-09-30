import type { Guia } from '../guia';

export const GUIA_FACTURACION: Guia = {
  id: 'facturacion',
  titulo: 'Facturación',
  modulo: 'Facturación',
  ruta: '/facturacion',
  resumen: 'La suma de la gestoría de los casos abiertos, la emisión de facturas y el cierre controlado de cada caso.',
  paraQue:
    'Facturar lo trabajado, llevar el control de qué está cobrado, y cerrar cada caso solo cuando sus cuentas cuadran.',
  claves: ['facturas', 'cobros', 'honorarios', 'verifactu', 'aeat', 'iva', 'cierre de caso'],
  tareas: [
    {
      id: 'facturar-caso',
      titulo: 'Generar la factura de un caso',
      claves: ['emitir factura', 'crear factura', 'facturar', 'cobrar', 'líneas'],
      requiere: { modulo: 'Facturación', capacidad: 'crear' },
      pasos: [
        'En Facturación, ve a la pestaña "Casos abiertos".',
        'En la fila del caso, pulsa "Generar factura". Si el caso ya tiene alguna, el botón dice "Nueva factura".',
        'Indica la "Fecha emisión", la "Fecha vencimiento" y la "Tasa de IVA (%)".',
        'En "Líneas", pulsa "Agregar línea" y escribe el concepto, la "Cantidad" y el "Precio Ud.".',
        'Revisa la "Base imponible", el IVA y el "Total".',
        'Pulsa "Generar factura".',
      ],
      nota: 'Si el despacho tiene Verifactu activado, la factura se registra automáticamente en la AEAT y después ya no puede editarse.',
    },
    {
      id: 'factura-libre',
      titulo: 'Crear una factura que no pertenece a ningún caso',
      claves: ['factura libre', 'factura suelta', 'sin caso', 'standalone'],
      requiere: { modulo: 'Facturación', capacidad: 'crear' },
      pasos: [
        'En la cabecera de Facturación, pulsa "Nueva factura".',
        'Rellena las fechas, la tasa de IVA y las líneas igual que en una factura de caso.',
        'Pulsa "Generar factura".',
      ],
    },
    {
      id: 'gestionar-facturas',
      titulo: 'Buscar, descargar y cobrar facturas',
      claves: ['pdf', 'descargar', 'pagada', 'cobrada', 'borrador', 'rectificativa', 'anular', 'listado'],
      pasos: [
        'Ve a la pestaña "Facturas".',
        'Filtra con "Buscar" (número, cliente o caso), "Estado", "Desde" y "Hasta".',
        'En cada factura tienes "Descargar PDF" y "Copiar enlace PDF".',
        'Según su estado, también "Editar factura", "Finalizar borrador", "Marcar como pagada", "Crear rectificativa" y "Anular factura".',
      ],
      nota: 'Las acciones que cambian una factura requieren permiso de edición en Facturación.',
    },
    {
      id: 'cerrar-caso-facturacion',
      titulo: 'Cerrar un caso y pasarlo al archivo',
      claves: ['cierre', 'archivar', 'finalizar caso', 'reabrir'],
      requiere: { modulo: 'Facturación', capacidad: 'editar' },
      pasos: [
        'En la pestaña "Casos abiertos", pulsa "Cerrar caso" en la fila del caso.',
        'Marca las dos confirmaciones: que los movimientos financieros están contemplados y que el saldo está corroborado en bancos.',
        'Confirma el cierre. El caso pasa a la pestaña "Archivo".',
      ],
      nota: 'Puedes cerrar un caso sin factura, aunque se recomienda facturar antes. Desde "Archivo", "Reabrir" lo devuelve a los casos abiertos.',
    },
    {
      id: 'registro-horas',
      titulo: 'Consultar las horas declaradas y lo pendiente de facturar',
      claves: ['horas', 'tiempo', 'sin facturar', 'valor pendiente', 'timesheet'],
      pasos: [
        'Ve a la pestaña "Registro de Horas".',
        'Arriba ves las "Horas totales", las que están "Sin facturar" y el "Valor pendiente".',
        'La tabla detalla cada registro por fecha, caso e hito, miembro, horas e importe.',
      ],
      nota: 'Las horas se registran desde el Calendario, en cada hito.',
    },
    {
      id: 'configurar-facturacion',
      titulo: 'Configurar los datos de facturación y Verifactu',
      claves: ['datos fiscales', 'razón social', 'verifactu', 'aeat', 'certificado digital', 'sandbox', 'emisor'],
      requiere: { modulo: 'Facturación', capacidad: 'editar' },
      pasos: [
        'En Facturación, pulsa "Configuración".',
        'En "Datos de facturación", elige el "Tipo de persona" y escribe el "Nombre / Razón social".',
        'En "Verifactu (AEAT)", marca "Activar envío automático a AEAT" si quieres registrar las facturas en Hacienda.',
        'Sube el "Certificado digital AEAT" y guarda los cambios.',
      ],
      nota: 'El "Modo sandbox" envía las facturas al entorno de pruebas de la AEAT, no al real. Úsalo solo para probar.',
    },
  ],
};
