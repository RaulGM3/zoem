import { describe, it, expect } from 'vitest';
import { saldoAprobado, saldoSistema, balancePorCuenta, type MovimientoSaldo } from './saldos';

/** Factory mínima para construir movimientos de prueba sin ruido. */
function mov(p: Partial<MovimientoSaldo>): MovimientoSaldo {
  return { importe: 0, esEntrada: true, aprobado: undefined, cuentaId: undefined, ...p };
}

describe('saldoSistema', () => {
  it('suma entradas y resta salidas, sin importar el estado de aprobación', () => {
    const movs = [
      mov({ importe: 100, esEntrada: true, aprobado: true }),
      mov({ importe: 30, esEntrada: false, aprobado: undefined }),
      mov({ importe: 20, esEntrada: false, aprobado: false }),
    ];
    expect(saldoSistema(movs)).toBe(50);
  });

  it('lista vacía da 0', () => {
    expect(saldoSistema([])).toBe(0);
  });
});

describe('saldoAprobado', () => {
  it('solo cuenta movimientos aprobados (aprobado === true), con signo', () => {
    const movs = [
      mov({ importe: 100, esEntrada: true, aprobado: true }),
      mov({ importe: 40, esEntrada: false, aprobado: true }),
      mov({ importe: 999, esEntrada: true, aprobado: undefined }), // pendiente → ignorado
      mov({ importe: 999, esEntrada: true, aprobado: false }), // rechazado → ignorado
    ];
    expect(saldoAprobado(movs)).toBe(60);
  });

  it('lista vacía da 0', () => {
    expect(saldoAprobado([])).toBe(0);
  });
});

describe('balancePorCuenta', () => {
  const cuentaA = { id: 'A', saldoBancario: 100 };
  const cuentaB = { id: 'B', saldoBancario: 0 };

  it('agrupa por cuentaId y calcula ingresos, egresos, sistema y proyección', () => {
    const movs = [
      mov({ cuentaId: 'A', importe: 200, esEntrada: true, aprobado: true }),
      mov({ cuentaId: 'A', importe: 50, esEntrada: false, aprobado: true }),
      mov({ cuentaId: 'A', importe: 30, esEntrada: false, aprobado: undefined }), // pendiente
      mov({ cuentaId: 'B', importe: 10, esEntrada: true, aprobado: true }),
    ];

    const res = balancePorCuenta([cuentaA, cuentaB], movs);
    const a = res.find(r => r.cuenta.id === 'A')!;

    expect(a.ingresos).toBe(200);
    expect(a.egresos).toBe(80); // 50 + 30
    expect(a.sistema).toBe(120); // 200 - 80
    expect(a.proyeccion).toBe(150); // solo aprobados: 200 - 50
  });

  it('una cuenta sin movimientos devuelve todo en cero', () => {
    const res = balancePorCuenta([cuentaB], []);
    const b = res[0];
    expect(b.ingresos).toBe(0);
    expect(b.egresos).toBe(0);
    expect(b.sistema).toBe(0);
    expect(b.proyeccion).toBe(0);
  });

  it('banco usa saldoBancario por defecto y calcula diferencia y conciliado contra la proyección', () => {
    const movs = [mov({ cuentaId: 'A', importe: 100, esEntrada: true, aprobado: true })];
    const res = balancePorCuenta([cuentaA], movs);
    const a = res[0];
    expect(a.banco).toBe(100);
    expect(a.diferencia).toBe(0); // 100 banco - 100 proyección
    expect(a.conciliado).toBe(true);
  });

  it('diferencia fuera de tolerancia marca no conciliado', () => {
    const movs = [mov({ cuentaId: 'A', importe: 80, esEntrada: true, aprobado: true })];
    const res = balancePorCuenta([cuentaA], movs); // banco 100, proyección 80
    expect(res[0].diferencia).toBe(20);
    expect(res[0].conciliado).toBe(false);
  });

  it('saldoRealPorCuenta tiene prioridad sobre saldoBancario', () => {
    const movs = [mov({ cuentaId: 'A', importe: 100, esEntrada: true, aprobado: true })];
    const res = balancePorCuenta([cuentaA], movs, new Map([['A', 250]]));
    expect(res[0].banco).toBe(250);
    expect(res[0].diferencia).toBe(150);
  });

  it('sin saldo bancario ni real, banco y diferencia son null y no concilia', () => {
    const sinSaldo = { id: 'C' };
    const res = balancePorCuenta([sinSaldo], []);
    expect(res[0].banco).toBeNull();
    expect(res[0].diferencia).toBeNull();
    expect(res[0].conciliado).toBe(false);
  });
});
