import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { crearEntorno, firestoreDe, CID } from './helpers';
import { derechosParaDoc } from '../functions/src/planes/derechosDoc';
import type { Suscripcion } from '../functions/src/planes/catalogo';
import { periodoMensual, ZONA_POR_DEFECTO } from '../functions/src/uso/periodo';

/**
 * Fase 3 · enforcement de planes en las rules. La forma de `derechos` sale de la MISMA función pura que
 * usa la Function `sincronizarDerechos`, así que estos tests validan el contrato real rules <-> Function.
 */

let env: RulesTestEnvironment;

const DIA = 86_400_000;
const sus = (p: Partial<Suscripcion>): Suscripcion => ({ plan: 'free', complementos: [], estado: 'activa', origen: 'manual', ...p });
/** Mes de cupo vigente según la zona de la empresa (por defecto Europe/Madrid), igual que `derechos.periodoUso`. */
const mesActual = (zona: string = ZONA_POR_DEFECTO) => periodoMensual(new Date(), zona).clave;

/** `derechos` tal y como los dejaría la Function `sincronizarDerechos` en el instante `ahora`. */
const derechos = (s: Suscripcion, ahora = new Date(), zona?: string) => derechosParaDoc(s, ahora, zona);

async function empresa(campos: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `companies/${CID}`), { name: 'Despacho', ...campos });
  });
}
async function uso(docId: string, campos: Record<string, number>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `companies/${CID}/uso/${docId}`), campos);
  });
}
const con = (s: Suscripcion | null, ahora?: Date) =>
  empresa(s ? { suscripcion: s, derechos: derechos(s, ahora) } : {});

// Fechas para "ya caducó": la prueba/demo empezó hace 20 días y terminó hace 6.
const hace = (dias: number) => new Date(Date.now() - dias * DIA);

beforeAll(async () => {
  env = await crearEntorno('demo-zoem-planes');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const m = (uid: string, role: string) =>
      setDoc(doc(db, `companies/${CID}/members/${uid}`), { userId: uid, companyId: CID, role, estado: 'activo' });
    await Promise.all([m('admin', 'Admin'), m('gestor', 'Gestor'), m('usuario', 'Usuario'), m('viewer', 'Viewer')]);
    await setDoc(doc(db, 'companies/c2'), { name: 'Otra' });
    await setDoc(doc(db, 'companies/c2/members/ajeno'), { userId: 'ajeno', companyId: 'c2', role: 'Admin', estado: 'activo' });
    await setDoc(doc(db, 'users/super'), { isSuperUser: true });
  });
});

// ---- Funciones de pago -------------------------------------------------------------------------
const COLECCIONES_TESORERIA = ['cuentas', 'cierres_caja', 'retiros', 'tesoreria_meta', 'movimientos_generales'] as const;
const escribirTesoreria = (uid: string, col: string) =>
  setDoc(doc(firestoreDe(env, uid), `companies/${CID}/${col}/x1`), { companyId: CID, nombre: 'x' });
const crearFactura = (uid: string) =>
  setDoc(doc(firestoreDe(env, uid), 'invoices/f1'), { companyId: CID, invoiceNumber: 'F-2026-1' });

describe('empresa legada (sin derechos): no se restringe nada', () => {
  beforeEach(() => con(null));
  it('el Gestor escribe tesorería, facturas y recepción IA', async () => {
    for (const col of COLECCIONES_TESORERIA) await assertSucceeds(escribirTesoreria('gestor', col));
    await assertSucceeds(crearFactura('gestor'));
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'gestor'), 'iaContacts/i1'), { companyId: CID }));
  });
});

describe('plan free: lo de pago se ve pero no se escribe', () => {
  beforeEach(() => con(sus({ plan: 'free' })));

  it('el Gestor NO escribe tesorería', async () => {
    for (const col of COLECCIONES_TESORERIA) await assertFails(escribirTesoreria('gestor', col));
  });
  it('NO crea facturas ni facturas recibidas ni gestoría', async () => {
    await assertFails(crearFactura('gestor'));
    await assertFails(setDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}/casos/k1/gestoria/g1`), { companyId: CID }));
  });
  it('NO crea contactos de recepción IA', async () => {
    await assertFails(setDoc(doc(firestoreDe(env, 'usuario'), 'iaContacts/i1'), { companyId: CID }));
  });
  it('NO edita llamadas ni borra datos de pago ya existentes (solo lectura, nunca se borra)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `companies/${CID}/cuentas/c1`), { companyId: CID, nombre: 'Caja' });
      await setDoc(doc(db, 'agentMappings/ag1'), { agentId: 'ag1', companyId: CID });
      await setDoc(doc(db, 'llamadas/l1'), { agentId: 'ag1', estado: 'completada' });
    });
    await assertFails(updateDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}/cuentas/c1`), { nombre: 'otra' }));
    await assertFails(deleteDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}/cuentas/c1`)));
    await assertFails(updateDoc(doc(firestoreDe(env, 'usuario'), 'llamadas/l1'), { descartada: true }));
  });
  it('LEE sus datos de pago (reducción a solo lectura, no pérdida de datos)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `companies/${CID}/cuentas/c1`), { companyId: CID, nombre: 'Caja' });
      await setDoc(doc(ctx.firestore(), 'invoices/f9'), { companyId: CID });
    });
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}/cuentas/c1`)));
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'gestor'), 'invoices/f9')));
  });
  it('SÍ escribe lo básico: contactos', async () => {
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/contactos/k1`), { nombre: 'Ana' }));
  });
  it('un complemento desbloquea su función', async () => {
    await con(sus({ plan: 'free', complementos: ['tesoreria'] }));
    await assertSucceeds(escribirTesoreria('gestor', 'cuentas'));
    await assertFails(crearFactura('gestor'));
  });
});

describe('prueba inversa', () => {
  it('vigente: todo abierto', async () => {
    await con(sus({ plan: 'free', estado: 'prueba', periodoFin: new Date(Date.now() + 3 * DIA) }));
    await assertSucceeds(escribirTesoreria('gestor', 'cuentas'));
    await assertSucceeds(crearFactura('gestor'));
  });
  it('caducada (aunque el scheduler aún no la haya cerrado): vuelve a free', async () => {
    const empezo = hace(20);
    await con(sus({ plan: 'free', estado: 'prueba', periodoFin: hace(6) }), empezo);
    await assertFails(escribirTesoreria('gestor', 'cuentas'));
    await assertFails(crearFactura('gestor'));
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/contactos/k1`), { nombre: 'Ana' }));
  });
});

describe('demo', () => {
  it('vigente: todas las funciones abiertas', async () => {
    await con(sus({ plan: 'demo', periodoFin: new Date(Date.now() + 5 * DIA) }));
    await assertSucceeds(escribirTesoreria('gestor', 'cuentas'));
    await assertSucceeds(crearFactura('gestor'));
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'gestor'), 'iaContacts/i1'), { companyId: CID }));
  });
  it('terminada: NADIE escribe en nada (datos conservados, solo lectura)', async () => {
    await con(sus({ plan: 'demo', periodoFin: hace(6) }), hace(20));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `companies/${CID}/contactos/k0`), { nombre: 'Existente' });
      await setDoc(doc(ctx.firestore(), `companies/${CID}/casos/c0`), { titulo: 'Existente' });
    });
    for (const uid of ['admin', 'gestor', 'usuario']) {
      await assertFails(setDoc(doc(firestoreDe(env, uid), `companies/${CID}/contactos/k1`), { nombre: 'Ana' }));
      await assertFails(setDoc(doc(firestoreDe(env, uid), `companies/${CID}/casos/c1`), { titulo: 'Nuevo' }));
    }
    await assertFails(updateDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/contactos/k0`), { nombre: 'Editado' }));
    await assertFails(deleteDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/casos/c0`)));
    await assertFails(setDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/settings/general`), { a: 1 }));
    await assertFails(updateDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}`), { saldoBancario: 5 }));
    await assertFails(escribirTesoreria('gestor', 'cuentas'));
    await assertFails(setDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/actividad/a1`), { companyId: CID }));
  });
  it('terminada: sigue LEYENDO todo', async () => {
    await con(sus({ plan: 'demo', periodoFin: hace(6) }), hace(20));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `companies/${CID}/contactos/k0`), { nombre: 'Existente' });
    });
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/contactos/k0`)));
    await assertSucceeds(getDocs(collection(firestoreDe(env, 'usuario'), `companies/${CID}/contactos`)));
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}`)));
  });
  it('terminada: el superusuario conserva el control', async () => {
    await con(sus({ plan: 'demo', periodoFin: hace(6) }), hace(20));
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'super'), `companies/${CID}/contactos/k1`), { nombre: 'Ana' }));
  });
});

// ---- Cupos --------------------------------------------------------------------------------------
describe('cupos de uso (contadores mantenidos por Functions)', () => {
  let n = 0;
  const crearPlantilla = (uid = 'usuario') =>
    setDoc(doc(firestoreDe(env, uid), `companies/${CID}/casoPlantillas/p-nueva-${++n}`), { nombre: 'Nueva' });

  it('plantillas: con 5/5 en free se rechaza la 6.ª; con 4/5 se permite la 5.ª', async () => {
    await con(sus({ plan: 'free' }));
    await uso('total', { plantillas: 4 });
    await assertSucceeds(crearPlantilla());
    await uso('total', { plantillas: 5 });
    await assertFails(crearPlantilla());
  });
  it('las subcolecciones de una plantilla (hitos) no gastan cupo', async () => {
    await con(sus({ plan: 'free' }));
    await uso('total', { plantillas: 5 });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `companies/${CID}/casoPlantillas/p1`), { nombre: 'Existente' });
    });
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casoPlantillas/p1/hitos/h1`), { titulo: 'Hito' }));
    await assertSucceeds(updateDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casoPlantillas/p1`), { nombre: 'Editada' }));
  });
  it('sin doc de uso cuenta como 0', async () => {
    await con(sus({ plan: 'free' }));
    await assertSucceeds(crearPlantilla());
  });
  it('pro (cupo alto) y enterprise (ilimitado) no se rechazan', async () => {
    await con(sus({ plan: 'pro' }));
    await uso('total', { plantillas: 50 });
    await assertSucceeds(crearPlantilla());
    await con(sus({ plan: 'enterprise' }));
    await uso('total', { plantillas: 5000 });
    await assertSucceeds(crearPlantilla());
  });
  it('empresa legada: ilimitado aunque haya doc de uso', async () => {
    await con(null);
    await uso('total', { plantillas: 5000 });
    await assertSucceeds(crearPlantilla());
  });

  it('casos activos: el cupo free (50) bloquea crear, no editar', async () => {
    await con(sus({ plan: 'free' }));
    await uso('total', { casosActivos: 50 });
    await assertFails(setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casos/nuevo`), { estado: 'pendiente' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `companies/${CID}/casos/viejo`), { estado: 'pendiente' });
      await setDoc(doc(ctx.firestore(), `companies/${CID}/casos/cerrado`), { estado: 'cerrado' });
    });
    await assertSucceeds(updateDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casos/viejo`), { titulo: 'x' }));
    await assertSucceeds(updateDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casos/viejo`), { estado: 'cerrado' }));
  });
  it('casos: reabrir un caso cerrado también consume cupo', async () => {
    await con(sus({ plan: 'free' }));
    await uso('total', { casosActivos: 50 });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `companies/${CID}/casos/cerrado`), { estado: 'cerrado' });
    });
    await assertFails(updateDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casos/cerrado`), { estado: 'urgente' }));
    await uso('total', { casosActivos: 49 });
    await assertSucceeds(updateDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casos/cerrado`), { estado: 'urgente' }));
  });

  it('demo: 10 contactos nuevos', async () => {
    await con(sus({ plan: 'demo', periodoFin: new Date(Date.now() + 5 * DIA) }));
    await uso('total', { contactos: 9 });
    await assertSucceeds(setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/contactos/k1`), { nombre: 'Ana' }));
    await uso('total', { contactos: 10 });
    await assertFails(setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/contactos/k2`), { nombre: 'Luis' }));
  });

  describe('acciones por mes', () => {
    let nr = 0;
    const registro = (uid = 'usuario') =>
      setDoc(doc(firestoreDe(env, uid), `companies/${CID}/accion_registros/r-nuevo-${++nr}`), {
        companyId: CID, accionId: 'a1', accionNombre: 'Aviso', contactoIds: ['k1'], canal: 'gmail',
        createdBy: uid, createdAt: serverTimestamp(),
      });
    it('free: la 16.ª ejecución del mes se rechaza', async () => {
      await con(sus({ plan: 'free' }));
      await uso(mesActual(), { accionesMes: 14 });
      await assertSucceeds(registro());
      await uso(mesActual(), { accionesMes: 15 });
      await assertFails(registro());
    });
    it('el cupo es del mes en curso: el contador de otro mes no cuenta', async () => {
      await con(sus({ plan: 'free' }));
      await uso('2020-01', { accionesMes: 999 });
      await assertSucceeds(registro());
    });

    describe('mes en la zona horaria de la empresa (derechos.periodoUso)', () => {
      it('cuenta el doc uso/<clave de periodoUso>, no el mes UTC', async () => {
        const s = sus({ plan: 'free' });
        // Una zona cuyo mes actual DIFIERA del UTC sería ideal, pero depende de la hora del test:
        // usamos una clave inventada en periodoUso para probar que las rules leen ESA clave.
        const d = derechos(s)!;
        const futuro = Timestamp.fromMillis(Date.now() + 10 * DIA);
        await empresa({ suscripcion: s, derechos: { ...d, periodoUso: { clave: 'zona-x', inicio: Timestamp.fromMillis(Date.now() - DIA), fin: futuro } } });
        await uso(mesActual(), { accionesMes: 999 }); // el mes UTC/Madrid está agotado, pero no es el de periodoUso
        await assertSucceeds(registro());
        await uso('zona-x', { accionesMes: 15 });
        await assertFails(registro());
        await uso('zona-x', { accionesMes: 14 });
        await assertSucceeds(registro());
      });

      it('periodoUso vencido y aún sin avanzar (scheduler pendiente): se trata como mes nuevo', async () => {
        const s = sus({ plan: 'free' });
        const d = derechos(s)!;
        await empresa({ suscripcion: s, derechos: { ...d, periodoUso: { clave: 'viejo', inicio: Timestamp.fromMillis(Date.now() - 40 * DIA), fin: Timestamp.fromMillis(Date.now() - 1000) } } });
        await uso('viejo', { accionesMes: 999 });
        await assertSucceeds(registro());
      });

      it('derechos sin periodoUso (documento anterior a esta versión): no limita el cupo mensual', async () => {
        const s = sus({ plan: 'free' });
        const { periodoUso: _p, ...sinPeriodo } = derechos(s)!;
        await empresa({ suscripcion: s, derechos: sinPeriodo });
        await uso(mesActual(), { accionesMes: 999 });
        await assertSucceeds(registro());
      });

      it('con la zona real (America/Bogota) la clave de periodoUso es la que se cuenta', async () => {
        const s = sus({ plan: 'free' });
        await empresa({ suscripcion: s, zonaHoraria: 'America/Bogota', derechos: derechos(s, new Date(), 'America/Bogota') });
        await uso(mesActual('America/Bogota'), { accionesMes: 15 });
        await assertFails(registro());
      });
    });
  });

  describe('usuarios', () => {
    const invitar = (uid = 'admin') =>
      setDoc(doc(firestoreDe(env, uid), 'companyInvitations/tok1'), {
        companyId: CID, email: 'nuevo@x.es', role: 'Usuario', status: 'pending', expiresAt: Timestamp.fromMillis(Date.now() + DIA),
      });
    const alta = () =>
      setDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/members/otro`), {
        userId: 'otro', companyId: CID, role: 'Usuario', estado: 'activo',
      });
    it('free (1 usuario) con 1 activo: no se invita ni se da de alta a nadie', async () => {
      await con(sus({ plan: 'free' }));
      await uso('total', { usuarios: 1 });
      await assertFails(invitar());
      await assertFails(alta());
    });
    it('pro con hueco: se puede', async () => {
      await con(sus({ plan: 'pro' }));
      await uso('total', { usuarios: 3 });
      await assertSucceeds(invitar());
      await assertSucceeds(alta());
    });
    it('el superusuario no está sujeto al cupo', async () => {
      await con(sus({ plan: 'free' }));
      await uso('total', { usuarios: 1 });
      await assertSucceeds(invitar('super'));
    });
  });

  describe('almacenamiento', () => {
    let n = 0;
    const subir = (bytes: number) =>
      setDoc(doc(firestoreDe(env, 'usuario'), `companies/${CID}/casos/k1/doc_files/f${++n}`), {
        name: 'a.pdf', sizeBytes: bytes, deleted: false, clasificado: false,
      });
    it('free (500 MB): rechaza un archivo que no cabe, acepta el que sí', async () => {
      await con(sus({ plan: 'free' }));
      await uso('total', { documentosBytes: 499 * 1_048_576 });
      await assertSucceeds(subir(1_048_576));
      await assertFails(subir(2 * 1_048_576));
    });
  });

  // REGLA LEGAL: tras una bajada de plan, lo ya subido sigue visible y la persona puede retirarlo ella misma;
  // solo las subidas NUEVAS se deniegan. Ninguna rule oculta ni bloquea la lectura por estar por encima del cupo.
  describe('bajada de plan con el almacenamiento por encima del cupo', () => {
    const MB = 1_048_576;
    const ruta = `companies/${CID}/casos/k1`;
    const sembrar = async () => {
      await con(sus({ plan: 'free' })); // free: 500 MB
      await uso('total', { documentosBytes: 800 * MB });
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, `${ruta}/doc_files/f1`), { name: 'a.pdf', sizeBytes: 5 * MB, deleted: false, clasificado: false, versions: [] });
        await setDoc(doc(db, `${ruta}/doc_slots/s1`), { name: 'Slot', status: 'subido', sizeBytes: 5 * MB, deleted: false, clasificado: false });
        await setDoc(doc(db, 'contact_files/cf1'), { companyId: CID, contactId: 'ct1', name: 'b.pdf', sizeBytes: 5 * MB, deleted: false, clasificado: false });
      });
    };

    it('se LEEN doc_files, doc_slots y contact_files existentes (cualquier miembro, incluido Viewer)', async () => {
      await sembrar();
      for (const uid of ['admin', 'gestor', 'usuario', 'viewer']) {
        await assertSucceeds(getDoc(doc(firestoreDe(env, uid), `${ruta}/doc_files/f1`)));
        await assertSucceeds(getDoc(doc(firestoreDe(env, uid), `${ruta}/doc_slots/s1`)));
        await assertSucceeds(getDoc(doc(firestoreDe(env, uid), 'contact_files/cf1')));
      }
      // Misma query que hace la app a un no-Admin (las rules solo dejan consultas demostrables).
      await assertSucceeds(getDocs(query(collection(firestoreDe(env, 'usuario'), `${ruta}/doc_files`), where('clasificado', '==', false))));
    });

    it('la persona puede retirar (soft delete) y retirar un slot: borrar libera cupo, nunca se bloquea', async () => {
      await sembrar();
      const ahora = serverTimestamp();
      await assertSucceeds(updateDoc(doc(firestoreDe(env, 'usuario'), `${ruta}/doc_files/f1`), { deleted: true, deletedAt: ahora }));
      await assertSucceeds(updateDoc(doc(firestoreDe(env, 'usuario'), 'contact_files/cf1'), { deleted: true, deletedAt: ahora }));
      await assertSucceeds(updateDoc(doc(firestoreDe(env, 'usuario'), `${ruta}/doc_slots/s1`), { status: 'pendiente', sizeBytes: null }));
    });

    it('solo se deniegan los archivos NUEVOS (doc_files y contact_files), con 1 byte ya sobra', async () => {
      await sembrar();
      await assertFails(setDoc(doc(firestoreDe(env, 'usuario'), `${ruta}/doc_files/nuevo`), {
        name: 'n.pdf', sizeBytes: 1, deleted: false, clasificado: false,
      }));
      await assertFails(setDoc(doc(firestoreDe(env, 'usuario'), 'contact_files/nuevo'), {
        companyId: CID, contactId: 'ct1', name: 'c.pdf', sizeBytes: 1, deleted: false, clasificado: false,
      }));
    });
  });
});

// ---- Los clientes no tocan los contadores ni los derechos ---------------------------------------
describe('integridad de contadores y derechos', () => {
  beforeEach(() => con(sus({ plan: 'free' })));

  it('nadie (ni Admin) escribe en uso/*; los miembros sí lo leen', async () => {
    await uso('total', { plantillas: 1 });
    await assertFails(setDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/uso/total`), { plantillas: 0 }));
    await assertFails(updateDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/uso/total`), { plantillas: 0 }));
    await assertFails(setDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}/uso/${mesActual()}`), { accionesMes: 0 }));
    await assertFails(setDoc(doc(firestoreDe(env, 'super'), `companies/${CID}/uso/total`), { plantillas: 0 }));
    await assertSucceeds(getDoc(doc(firestoreDe(env, 'viewer'), `companies/${CID}/uso/total`)));
  });
  it('un Admin/Gestor no se concede derechos ni se quita límites', async () => {
    await assertFails(updateDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}`), { 'derechos.limites.usuarios': null }));
    await assertFails(updateDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}`), { derechos: null }));
    await assertFails(updateDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}`), { 'derechos.funciones.tesoreria': true }));
  });
  it('zonaHoraria: solo el Admin la cambia, debe ser un string corto', async () => {
    const ref = (uid: string) => doc(firestoreDe(env, uid), `companies/${CID}`);
    await assertSucceeds(updateDoc(ref('admin'), { zonaHoraria: 'America/Bogota' }));
    await assertFails(updateDoc(ref('gestor'), { zonaHoraria: 'America/Lima' }));
    await assertFails(updateDoc(ref('usuario'), { zonaHoraria: 'America/Lima' }));
    await assertFails(updateDoc(ref('admin'), { zonaHoraria: 42 }));
    await assertFails(updateDoc(ref('admin'), { zonaHoraria: '' }));
    await assertFails(updateDoc(ref('admin'), { zonaHoraria: 'x'.repeat(65) }));
    await assertSucceeds(updateDoc(ref('super'), { zonaHoraria: 'America/Lima' }));
  });
  it('un Gestor puede seguir guardando otros datos aunque el formulario reenvíe la misma zona', async () => {
    await empresa({ suscripcion: sus({ plan: 'free' }), zonaHoraria: 'America/Bogota', derechos: derechos(sus({ plan: 'free' }), new Date(), 'America/Bogota') });
    await assertSucceeds(updateDoc(doc(firestoreDe(env, 'gestor'), `companies/${CID}`), { zonaHoraria: 'America/Bogota', ciudad: 'Bogotá' }));
  });
  it('nadie escribe derechos.periodoUso desde el cliente', async () => {
    await assertFails(updateDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}`), { 'derechos.periodoUso.clave': 'x' }));
  });
  it('un Admin sigue pudiendo editar ajustes normales de la empresa', async () => {
    await assertSucceeds(updateDoc(doc(firestoreDe(env, 'admin'), `companies/${CID}`), { saldoBancario: 10 }));
  });
  it('un usuario de otra empresa no escribe ni lee nada de esta', async () => {
    await assertFails(escribirTesoreria('ajeno', 'cuentas'));
    await assertFails(getDoc(doc(firestoreDe(env, 'ajeno'), `companies/${CID}/uso/total`)));
  });
});
