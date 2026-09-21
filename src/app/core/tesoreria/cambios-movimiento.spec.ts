import { describe, it, expect } from 'vitest';
import { describirCambios, type MovimientoAuditable } from './cambios-movimiento';

function mov(p: Partial<MovimientoAuditable> = {}): MovimientoAuditable {
  return {
    tipo: 'gasto',
    concepto: 'Tasa judicial',
    importe: 100,
    esEntrada: false,
    fecha: '2026-06-15',
    notas: undefined,
    cuentaId: undefined,
    ...p,
  };
}

describe('describirCambios', () => {
  it('sin cambios devuelve lista vacía', () => {
    expect(describirCambios(mov(), mov())).toEqual([]);
  });

  it('ignora los campos ausentes en el parche', () => {
    expect(describirCambios(mov({ importe: 100 }), {})).toEqual([]);
  });

  it('describe el cambio de importe con formato de moneda', () => {
    expect(describirCambios(mov({ importe: 100 }), { importe: 150.5 }))
      .toEqual(['importe: 100,00 € → 150,50 €']);
  });

  it('describe el cambio de concepto entrecomillado', () => {
    expect(describirCambios(mov({ concepto: 'Tasa' }), { concepto: 'Tasa judicial' }))
      .toEqual(['concepto: "Tasa" → "Tasa judicial"']);
  });

  it('describe el cambio de tipo y de fecha', () => {
    expect(describirCambios(mov(), { tipo: 'suplido', fecha: '2026-07-01' }))
      .toEqual(['tipo: gasto → suplido', 'fecha: 2026-06-15 → 2026-07-01']);
  });

  it('traduce la dirección a entrada/salida', () => {
    expect(describirCambios(mov({ esEntrada: false }), { esEntrada: true }))
      .toEqual(['dirección: salida → entrada']);
  });

  it('muestra "—" cuando un campo opcional estaba vacío', () => {
    expect(describirCambios(mov({ notas: undefined }), { notas: 'Pagado en caja' }))
      .toEqual(['notas: "—" → "Pagado en caja"']);
  });

  it('usa el nombre de la cuenta cuando se le pasa el mapa', () => {
    const nombres = new Map([['c1', 'BBVA'], ['c2', 'Santander']]);
    expect(describirCambios(mov({ cuentaId: 'c1' }), { cuentaId: 'c2' }, nombres))
      .toEqual(['cuenta: BBVA → Santander']);
  });

  it('cae al id de cuenta si no está en el mapa', () => {
    expect(describirCambios(mov({ cuentaId: 'c1' }), { cuentaId: 'c9' }))
      .toEqual(['cuenta: c1 → c9']);
  });

  it('acumula varios cambios en el orden declarado', () => {
    const cambios = describirCambios(
      mov({ concepto: 'Tasa', importe: 100, tipo: 'gasto' }),
      { importe: 200, concepto: 'Tasa judicial', tipo: 'suplido' },
    );
    expect(cambios).toEqual([
      'concepto: "Tasa" → "Tasa judicial"',
      'tipo: gasto → suplido',
      'importe: 100,00 € → 200,00 €',
    ]);
  });

  it('un valor idéntico dentro de un parche con cambios no se reporta', () => {
    expect(describirCambios(mov({ importe: 100, concepto: 'Tasa' }), { importe: 100, concepto: 'Otra' }))
      .toEqual(['concepto: "Tasa" → "Otra"']);
  });
});
