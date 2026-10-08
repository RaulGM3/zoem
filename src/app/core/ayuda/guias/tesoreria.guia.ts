import type { Guia } from '../guia';

export const GUIA_TESORERIA: Guia = {
  id: 'tesoreria',
  titulo: 'Tesorería',
  modulo: 'Tesorería',
  ruta: '/tesoreria',
  resumen: 'La contabilidad de los casos y su cotejo con el banco: cuentas, movimientos, conciliación, cierres de caja y reportes.',
  paraQue:
    'Saber cuánto dinero hay de verdad, comprobar que lo registrado en Vertey coincide con el banco y sacar los números del periodo.',
  aSaber: [
    'El saldo aprobado de cada cuenta solo suma los movimientos aprobados.',
    'Los cobros y gastos de un caso se registran en el caso, no aquí; aquí van los gastos de oficina y los ajustes.',
    'Necesitas al menos una cuenta para conciliar extractos y hacer cierres de caja.',
  ],
  claves: ['bancos', 'caja', 'dinero', 'contabilidad', 'saldo', 'cuentas bancarias', 'movimientos', 'conciliación'],
  tareas: [
    {
      id: 'crear-cuenta',
      titulo: 'Dar de alta una cuenta bancaria o una caja',
      claves: ['nueva cuenta', 'banco', 'caja', 'iban', 'entidad'],
      requiere: { modulo: 'Tesorería', capacidad: 'editar' },
      pasos: [
        'En Tesorería, pulsa "Cuentas".',
        'Pulsa "Nueva cuenta".',
        'Elige "Banco" o "Caja" y escribe el "Nombre". La "Entidad bancaria" y el "IBAN" son opcionales.',
        'Pulsa "Guardar".',
      ],
      nota: 'Hace falta al menos una cuenta para conciliar extractos y para hacer un cierre de caja.',
    },
    {
      id: 'movimiento-general',
      titulo: 'Registrar un movimiento que no es de ningún caso',
      claves: ['gasto de oficina', 'alquiler', 'saldo inicial', 'ajuste', 'mov. general', 'movimiento general', 'registrar movimiento'],
      requiere: { modulo: 'Tesorería', capacidad: 'crear' },
      pasos: [
        'En Tesorería, pulsa "Mov. general".',
        'Elige el "Tipo" y la "Dirección": "Entrada" o "Salida".',
        'Escribe el "Concepto", el importe y el "IVA". Marca "IVA incluido en el precio" si el importe ya lo lleva.',
        'Indica la "Fecha" y la "Cuenta bancaria".',
        'Guarda el movimiento.',
      ],
      nota: 'Sirve para gastos de oficina, saldos iniciales y ajustes de balance. Los cobros y gastos de un caso se registran en el propio caso, en la pestaña "Gestoría".',
    },
    {
      id: 'aprobar-movimientos',
      titulo: 'Revisar y aprobar movimientos',
      claves: ['revisión', 'aprobar', 'validar', 'pendientes', 'confirmar'],
      requiere: { modulo: 'Tesorería', capacidad: 'editar' },
      pasos: [
        'Ve a la pestaña "Movimientos".',
        'En "Revisión de movimientos", pulsa "Aprobar movimiento" en cada uno que sea correcto.',
        'Cuando el cotejo esté conciliado, "Aprobar todos" confirma de una vez los pendientes.',
      ],
      nota: 'El saldo aprobado de cada cuenta solo suma los movimientos aprobados.',
    },
    {
      id: 'cotejo-bancario',
      titulo: 'Cotejar el saldo de Vertey con el saldo real del banco',
      claves: ['cotejo', 'saldo real', 'discrepancia', 'diferencia', 'cuadrar', 'comprobar saldo'],
      requiere: { modulo: 'Tesorería', capacidad: 'editar' },
      pasos: [
        'Ve a la pestaña "Resumen".',
        'En "Cotejo bancario", escribe el "Saldo bancario real" y pulsa "Guardar".',
        'Compara con el "Saldo aprobado". Si coinciden, la cuenta aparece como "Conciliado".',
        'Si hay "Discrepancia", ábrela para ver la diferencia y las posibles causas.',
      ],
      nota: 'Las causas habituales son movimientos sin aprobar, transferencias entre cuentas sin registrar, comisiones del banco o un saldo real mal escrito.',
    },
    {
      id: 'conciliar-extracto',
      titulo: 'Conciliar el extracto del banco',
      claves: ['extracto', 'csv', 'importar', 'casar', 'conciliación', 'banco'],
      requiere: { modulo: 'Tesorería', capacidad: 'editar' },
      pasos: [
        'Ve a la pestaña "Conciliación" y selecciona la cuenta.',
        'Pulsa "Importar extracto (CSV)" y elige el archivo del banco.',
        'Pulsa "Conciliar automáticamente" para casar las líneas que coincidan.',
        'En las que queden pendientes, usa "Casar con…" para elegir el movimiento, o "Ignorar línea".',
      ],
      nota: '"Deshacer" devuelve una línea a pendiente.',
    },
    {
      id: 'cierre-caja',
      titulo: 'Hacer un cierre de caja',
      claves: ['cierre', 'arqueo', 'fin de mes', 'cerrar periodo'],
      requiere: { modulo: 'Tesorería', capacidad: 'editar' },
      pasos: [
        'En Tesorería, pulsa "Cierre de caja".',
        'Revisa los ingresos, los egresos y el total del sistema de cada cuenta.',
        'Añade "Notas" si hace falta y pulsa "Confirmar cierre".',
      ],
      nota: 'Los cierres anteriores quedan listados en la pestaña "Resumen", en "Cierres de caja".',
    },
    {
      id: 'reportes-tesoreria',
      titulo: 'Sacar el resultado del periodo y la liquidación de IVA',
      claves: ['reportes', 'informe', 'pérdidas y ganancias', 'iva 303', 'exportar', 'csv', 'trimestre'],
      pasos: [
        'Ve a la pestaña "Reportes".',
        'Elige el periodo con "Desde" y "Hasta".',
        'Consulta los ingresos, los egresos, el resultado, la "Liquidación IVA (303)" y las pérdidas y ganancias por tipo.',
        'Pulsa "Exportar CSV" para llevarte los movimientos del periodo.',
      ],
    },
    {
      id: 'contabilidad-por-caso',
      titulo: 'Ver la contabilidad de cada caso',
      claves: ['saldo por caso', 'ingresos por caso', 'rentabilidad', 'proyectado'],
      pasos: [
        'Ve a la pestaña "Casos".',
        '"Contabilidad por caso" muestra los ingresos, los honorarios, los egresos, el saldo aprobado y el saldo proyectado de cada uno.',
      ],
      nota: 'Un caso aparece aquí cuando tiene movimientos de gestoría registrados.',
    },
  ],
};
