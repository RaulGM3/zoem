import { describe, it, expect } from 'vitest';
import {
  demoVencida,
  derechosEfectivos,
  diasRestantes,
  estadoCupo,
  funcionDeModulo,
  funcionDeRuta,
  limiteDe,
  soloLectura,
  suscripcionLegada,
  tieneFuncion,
} from './derechos';
import { FUNCIONES, type Suscripcion } from './catalogo';

const AHORA = new Date('2026-10-09T12:00:00Z');
const manana = new Date('2026-10-10T12:00:00Z');
const ayer = new Date('2026-10-08T12:00:00Z');

const sus = (parcial: Partial<Suscripcion>): Suscripcion => ({
  plan: 'free',
  complementos: [],
  estado: 'activa',
  origen: 'manual',
  ...parcial,
});

describe('derechosEfectivos', () => {
  it('free: solo lo básico, con cupos', () => {
    const d = derechosEfectivos(sus({ plan: 'free' }), AHORA);
    expect(tieneFuncion(d, 'contactos')).toBe(true);
    expect(tieneFuncion(d, 'plazos')).toBe(true);
    expect(tieneFuncion(d, 'tesoreria')).toBe(false);
    expect(tieneFuncion(d, 'facturacion')).toBe(false);
    expect(limiteDe(d, 'usuarios')).toBe(1);
    expect(limiteDe(d, 'plantillas')).toBe(5);
    expect(limiteDe(d, 'accionesMes')).toBe(15);
  });

  it('pro: todas las funciones', () => {
    const d = derechosEfectivos(sus({ plan: 'pro' }), AHORA);
    expect(tieneFuncion(d, 'tesoreria')).toBe(true);
    expect(tieneFuncion(d, 'agenteIA')).toBe(true);
    expect(limiteDe(d, 'usuarios')).toBeGreaterThan(1);
  });

  it('enterprise: todo ilimitado', () => {
    const d = derechosEfectivos(sus({ plan: 'enterprise' }), AHORA);
    expect(tieneFuncion(d, 'informes')).toBe(true);
    expect(limiteDe(d, 'plantillas')).toBe(Infinity);
    expect(limiteDe(d, 'contactos')).toBe(Infinity);
  });

  it('demo vigente: todas las funciones pero cupos de uso bajos', () => {
    const d = derechosEfectivos(sus({ plan: 'demo', periodoFin: manana }), AHORA);
    for (const f of FUNCIONES) expect(tieneFuncion(d, f)).toBe(true);
    expect(d.limites).toMatchObject({
      usuarios: 1, plantillas: 3, casosActivos: 10, contactos: 10, accionesMes: 5, iaMensajesMes: 10, documentosMB: 50,
    });
  });

  it('un complemento suma funciones y cupos al plan', () => {
    const d = derechosEfectivos(sus({ plan: 'free', complementos: ['tesoreria', 'usuariosExtra5'] }), AHORA);
    expect(tieneFuncion(d, 'tesoreria')).toBe(true);
    expect(tieneFuncion(d, 'facturacion')).toBe(false);
    expect(limiteDe(d, 'usuarios')).toBe(6);
  });

  it('los cupos extra no rompen un plan ilimitado', () => {
    const d = derechosEfectivos(sus({ plan: 'enterprise', complementos: ['usuariosExtra5'] }), AHORA);
    expect(limiteDe(d, 'usuarios')).toBe(Infinity);
  });

  it('ignora complementos desconocidos', () => {
    const s = sus({ plan: 'free', complementos: ['inexistente' as never] });
    expect(() => derechosEfectivos(s, AHORA)).not.toThrow();
  });

  it('los ajustes manuales prevalecen (null = ilimitado)', () => {
    const d = derechosEfectivos(
      sus({ plan: 'free', ajustes: { funciones: { informes: true }, limites: { plantillas: null, usuarios: 3 } } }),
      AHORA,
    );
    expect(tieneFuncion(d, 'informes')).toBe(true);
    expect(limiteDe(d, 'plantillas')).toBe(Infinity);
    expect(limiteDe(d, 'usuarios')).toBe(3);
  });

  describe('prueba inversa', () => {
    it('en prueba vigente da derechos pro', () => {
      const d = derechosEfectivos(sus({ plan: 'free', estado: 'prueba', periodoFin: manana }), AHORA);
      expect(tieneFuncion(d, 'tesoreria')).toBe(true);
    });
    it('acepta Timestamp de Firestore (toDate)', () => {
      const ts = { toDate: () => manana };
      const d = derechosEfectivos(sus({ estado: 'prueba', periodoFin: ts as never }), AHORA);
      expect(tieneFuncion(d, 'tesoreria')).toBe(true);
    });
    it('prueba vencida baja a free', () => {
      const d = derechosEfectivos(sus({ plan: 'free', estado: 'prueba', periodoFin: ayer }), AHORA);
      expect(tieneFuncion(d, 'tesoreria')).toBe(false);
    });
    it('prueba sin fecha se considera vencida', () => {
      const d = derechosEfectivos(sus({ plan: 'free', estado: 'prueba' }), AHORA);
      expect(tieneFuncion(d, 'tesoreria')).toBe(false);
    });
  });

  describe('estado de la suscripción', () => {
    it('vencida o cancelada cae a free y pierde complementos', () => {
      for (const estado of ['vencida', 'cancelada'] as const) {
        const d = derechosEfectivos(sus({ plan: 'pro', estado, complementos: ['tesoreria'] }), AHORA);
        expect(tieneFuncion(d, 'tesoreria')).toBe(false);
        expect(limiteDe(d, 'usuarios')).toBe(1);
      }
    });
    it('demo sin periodoFin (anterior a la fase 3) no caduca', () => {
      const d = derechosEfectivos(sus({ plan: 'demo', estado: 'vencida' }), AHORA);
      expect(tieneFuncion(d, 'tesoreria')).toBe(true);
    });
    it('demo con periodoFin pasado cae a free', () => {
      const d = derechosEfectivos(sus({ plan: 'demo', periodoFin: ayer }), AHORA);
      expect(tieneFuncion(d, 'tesoreria')).toBe(false);
      expect(limiteDe(d, 'usuarios')).toBe(1);
    });
  });

  describe('demoVencida / soloLectura', () => {
    it('demo con periodoFin <= ahora está vencida', () => {
      expect(demoVencida(sus({ plan: 'demo', periodoFin: ayer }), AHORA)).toBe(true);
      expect(demoVencida(sus({ plan: 'demo', periodoFin: AHORA }), AHORA)).toBe(true);
    });
    it('demo vigente, sin fecha o de otro plan no está vencida', () => {
      expect(demoVencida(sus({ plan: 'demo', periodoFin: manana }), AHORA)).toBe(false);
      expect(demoVencida(sus({ plan: 'demo' }), AHORA)).toBe(false);
      expect(demoVencida(sus({ plan: 'free', periodoFin: ayer }), AHORA)).toBe(false);
      expect(demoVencida(null, AHORA)).toBe(false);
    });
    it('soloLectura = demo vencida', () => {
      expect(soloLectura(sus({ plan: 'demo', periodoFin: ayer }), AHORA)).toBe(true);
      expect(soloLectura(sus({ plan: 'pro' }), AHORA)).toBe(false);
    });
  });

  describe('empresas legadas (sin suscripcion)', () => {
    it('sin suscripcion ni plan => pro (no pierden funciones)', () => {
      for (const s of [null, undefined]) {
        const d = derechosEfectivos(s, AHORA);
        expect(tieneFuncion(d, 'tesoreria')).toBe(true);
        expect(tieneFuncion(d, 'facturacion')).toBe(true);
      }
    });
    it('suscripcionLegada: enterprise se conserva, el resto es pro', () => {
      expect(suscripcionLegada(undefined).plan).toBe('pro');
      expect(suscripcionLegada('enterprise').plan).toBe('enterprise');
      expect(suscripcionLegada('pro').plan).toBe('pro');
    });
    it("suscripcionLegada: 'free' legado NO restringe (el campo nunca se aplicó y el alta lo ponía por defecto)", () => {
      expect(suscripcionLegada('free').plan).toBe('pro');
      expect(suscripcionLegada('basic').plan).toBe('pro');
    });
  });
});

describe('estadoCupo', () => {
  it('ok por debajo del 80 %', () => {
    expect(estadoCupo(3, 5)).toBe('ok');
  });
  it('aviso desde el 80 %', () => {
    expect(estadoCupo(4, 5)).toBe('aviso');
  });
  it('agotado al 100 % o más', () => {
    expect(estadoCupo(5, 5)).toBe('agotado');
    expect(estadoCupo(9, 5)).toBe('agotado');
  });
  it('ilimitado siempre ok', () => {
    expect(estadoCupo(1_000_000, Infinity)).toBe('ok');
  });
  it('cupo 0 con cualquier uso está agotado', () => {
    expect(estadoCupo(0, 0)).toBe('agotado');
  });
});

describe('diasRestantes', () => {
  it('redondea hacia arriba', () => {
    expect(diasRestantes(manana, AHORA)).toBe(1);
    expect(diasRestantes(new Date('2026-10-23T11:00:00Z'), AHORA)).toBe(14);
  });
  it('0 si venció o no hay fecha', () => {
    expect(diasRestantes(ayer, AHORA)).toBe(0);
    expect(diasRestantes(null, AHORA)).toBe(0);
  });
});

describe('funcionDeModulo / funcionDeRuta', () => {
  it('mapea módulos de pago', () => {
    expect(funcionDeModulo('Facturación')).toBe('facturacion');
    expect(funcionDeModulo('Tesorería')).toBe('tesoreria');
    expect(funcionDeModulo('RecepciónIA')).toBe('recepcionIA');
    expect(funcionDeModulo('Informes')).toBe('informes');
  });
  it('módulos del free no se gatean', () => {
    expect(funcionDeModulo('Casos')).toBeNull();
    expect(funcionDeModulo('Configuración')).toBeNull();
  });
  it('mapea rutas sin módulo', () => {
    expect(funcionDeRuta('/agente-ia')).toBe('agenteIA');
    expect(funcionDeRuta('/llamadas')).toBe('recepcionIA');
    expect(funcionDeRuta('/informes')).toBe('informes');
    expect(funcionDeRuta('/casos')).toBeNull();
  });
});
