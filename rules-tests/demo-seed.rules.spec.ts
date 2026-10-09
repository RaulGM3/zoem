import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { crearEntorno, firestoreDe, CID } from './helpers';
import { derechosParaDoc } from '../functions/src/planes/derechosDoc';
import { adaptarParaMiembro, construirSeedDemo, esSembrableComoMiembro } from '../src/app/core/demo/seed-demo-civil';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-demo-seed');
});
afterAll(async () => {
  await env.cleanup();
});

/**
 * El despacho de ejemplo se siembra DESDE EL CLIENTE como Admin del despacho (no como superusuario).
 * Este test garantiza que cada doc que el seed manda al cliente pasa las rules reales.
 */
describe('seed del despacho demo como Admin', () => {
  const sembrar = async () => {
    const seed = construirSeedDemo({
      companyId: CID,
      miembros: [{ uid: 'admin', nombre: 'Ana Admin', role: 'Admin' }],
      hoy: new Date(2026, 9, 6, 9, 30),
      ultimaFacturaPorAnio: {},
      agente: { agentId: `demo-agente-${CID}`, crear: true },
    });
    const db = firestoreDe(env, 'admin');
    const fallos: Record<string, string> = {};
    for (const d of adaptarParaMiembro(seed.docs.filter(esSembrableComoMiembro), 'admin', serverTimestamp())) {
      try {
        await setDoc(doc(db, d.path), d.data);
      } catch (e) {
        const col = d.path.split('/').filter((_, i) => i % 2 === 0).join('/');
        fallos[col] = (e as Error).message.slice(0, 400);
      }
    }
    // Facturas recibidas: mismas escrituras que DemoSeedService.crearFacturaRecibida.
    let n = 0;
    for (const fr of seed.facturasRecibidas) {
      try {
        await setDoc(doc(db, `companies/${CID}/facturas_recibidas/${fr.id}`), {
          ...fr.data, numeroRecepcion: ++n, createdBy: 'admin', createdAt: serverTimestamp(),
        });
      } catch (e) {
        fallos['facturas_recibidas'] = (e as Error).message.slice(0, 400);
      }
    }
    expect(fallos).toEqual({});
  };

  it('todos los docs sembrables por un miembro son escribibles por el Admin', sembrar);

  it('...y también con la empresa como demo vigente (derechos denormalizados: funciones abiertas, cupos bajos)', async () => {
    // El seed ya escribió la primera pasada: partimos de cero (las acciones/facturas existentes son solo-crear).
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `companies/${CID}/members/admin`), {
        userId: 'admin', companyId: CID, role: 'Admin', estado: 'activo',
      });
      await setDoc(doc(ctx.firestore(), `companies/${CID}`), {
        name: 'Demo',
        suscripcion: { plan: 'demo', estado: 'activa' },
        derechos: derechosParaDoc(
          { plan: 'demo', estado: 'activa', complementos: [], origen: 'manual', periodoFin: new Date(Date.now() + 5 * 86_400_000) },
          new Date(),
        ),
      });
    });
    await sembrar();
  });
});
