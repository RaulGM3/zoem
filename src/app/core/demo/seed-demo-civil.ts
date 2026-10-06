/**
 * Construye (sin I/O) todos los documentos de la empresa demo de abogado civil.
 * El servicio `DemoSeedService` los escribe; aquí solo hay lógica pura y testeable.
 *
 * Reglas:
 * - Ids deterministas con prefijo `demo-`: re-ejecutar sobrescribe, no duplica.
 * - Fechas relativas a `hoy`: re-ejecutar "rejuvenece" la demo.
 * - Cada documento lleva como actor (createdBy/updatedBy/creadoPor) al MISMO
 *   miembro al que se asigna: los triggers de notificación no avisan al actor,
 *   así que cargar la demo no dispara un push por documento.
 * - Las facturas recibidas van aparte: sus rules exigen transacción con el
 *   contador correlativo, `createdBy == auth.uid` y `createdAt == request.time`.
 * - Tesorería cuadra como en la app: el saldo de sistema es la suma de
 *   movimientos (la apertura es un movimiento `ajuste`), el saldo bancario es el
 *   último `saldoPosterior` del extracto y los retiros no entran en los saldos.
 */
import { desglosarIva, type TipoIva } from '../../interfaces/iva';
import { RESUMEN_FINANCIERO_VACIO, type ResumenFinanciero } from '../../interfaces/caso.interface';
import type { Modulo } from '../permissions/permissions';
import { claveFactura } from '../facturas-recibidas/clave-factura';
import {
  ACCIONES, ACTIVIDAD, APERTURA_HACE, CASOS, CONTACTOS, CUENTAS, DIAS_HASTA_APROBAR, DIAS_HASTA_BANCO,
  EVENTOS, EXTRACTO_SUELTO, LEADS, LLAMADAS, PLANTILLAS, PUNTUALES, RECURRENTES, REGISTROS_ACCION,
  RETIRO_MENSUAL, SEGUIMIENTOS,
  type ContactoDemo, type CuentaDemo, type HitoDemo, type MovDemo, type ProveedorDemo,
} from './datos-demo-civil';

export interface MiembroSeed {
  uid: string;
  nombre: string;
  role: string;
}

export interface ContextoSeed {
  companyId: string;
  /** Miembros activos de la empresa. */
  miembros: MiembroSeed[];
  hoy: Date;
  /** Último número de la serie `F-AAAA-NNNN` por año (facturas reales). */
  ultimaFacturaPorAnio: Record<string, number>;
  /** Agente de Recepción IA de la empresa; `crear` si aún no tiene mapeo. */
  agente: { agentId: string; crear: boolean };
}

export interface DocSeed {
  path: string;
  data: Record<string, unknown>;
}

/** Factura recibida sin `numeroRecepcion`/`createdBy`/`createdAt` (los pone la transacción). */
export interface FacturaRecibidaSeed {
  id: string;
  ejercicio: number;
  data: Record<string, unknown>;
}

export interface SeedDemo {
  docs: DocSeed[];
  facturasRecibidas: FacturaRecibidaSeed[];
}

/** Prefijo de los ids demo en colecciones raíz (compartidas entre empresas). */
export const prefijoRaiz = (companyId: string) => `demo-${companyId}-`;
/** Id del agente que se crea si la empresa no tiene ninguno. */
export const agenteDemoId = (companyId: string) => `demo-agente-${companyId}`;

export function ultimaFacturaPorAnio(
  facturas: readonly { id: string; invoiceNumber?: string }[],
  companyId: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const fa of facturas) {
    if (fa.id.startsWith(prefijoRaiz(companyId))) continue;
    const mt = /^F-(\d{4})-(\d+)$/.exec(fa.invoiceNumber ?? '');
    if (mt) out[mt[1]] = Math.max(out[mt[1]] ?? 0, Number(mt[2]));
  }
  return out;
}

// ---------------------------------------------------------------------------

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const euros = (n: number) => n.toFixed(2).replace('.', ',');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function sinUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map(sinUndefined) as T;
  if (v && typeof v === 'object' && v.constructor === Object) {
    return Object.fromEntries(
      Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, sinUndefined(x)]),
    ) as T;
  }
  return v;
}

const desglose = (importe: number, iva: TipoIva) => ({
  tipoIva: iva,
  ivaExento: iva === 0,
  ...desglosarIva(importe, iva, iva === 0),
});

const contactoId = (i: number) => `demo-contacto-${pad(i + 1)}`;
const casoId = (key: string) => `demo-caso-${key}`;
const plantillaId = (key: string) => `demo-plantilla-${key}`;
const hitoPlantillaId = (i: number) => `hito-${pad(i + 1)}`;
const nombreContacto = (c: ContactoDemo) => (c.type === 'persona_fisica' ? `${c.nombre} ${c.apellidos}` : c.razonSocial);
const PLANT = new Map(PLANTILLAS.map((p) => [p.key, p]));

/** Réplica de CasosService.recalcularResumen. */
function resumenDe(movs: readonly MovDemo[]): ResumenFinanciero {
  const r: ResumenFinanciero = { ...RESUMEN_FINANCIERO_VACIO };
  for (const mv of movs) {
    const { cuotaIva } = desglose(mv.importe, mv.iva);
    if (mv.esEntrada) {
      if (mv.tipo === 'honorario') r.totalHonorarios += mv.importe;
      else r.totalIngresos += mv.importe;
      r.ivaRepercutido += cuotaIva;
    } else {
      r.totalEgresos += mv.importe;
      r.ivaSoportado += cuotaIva;
      if (mv.tipo === 'suplido') r.totalSuplidos += mv.importe;
      else if (mv.tipo === 'honorario') r.totalHonorariosSalida += mv.importe;
    }
  }
  r.saldo = r.totalIngresos + r.totalHonorarios - r.totalEgresos;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r2(v)])) as unknown as ResumenFinanciero;
}

const HORAS_AGENDA = ['09:30', '11:00', '12:30', '16:00', '17:30'];

/** Movimiento ya resuelto a un doc concreto (de caso o general). */
interface MovSembrado extends MovDemo {
  id: string;
  aprobadoAhora: boolean;
  casoKey?: string;
}

export function construirSeedDemo(ctx: ContextoSeed): SeedDemo {
  if (ctx.miembros.length === 0) throw new Error('La empresa no tiene miembros activos');

  const hoy = new Date(ctx.hoy);
  hoy.setHours(12, 0, 0, 0);
  const dia = (offset: number, hh = 12, mm = 0) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + offset);
    d.setHours(hh, mm, 0, 0);
    return d;
  };
  const iso = (offset: number) => {
    const d = dia(offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const offsetDe = (y: number, m: number, d: number) => Math.round((new Date(y, m, d, 12).getTime() - hoy.getTime()) / 86_400_000);
  /** Meses desde el actual (k = 0) hacia atrás. */
  const mesAtras = (k: number) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    return { y, m, label: `${MESES[m]} ${y}`, sufijo: `${y}${pad(m + 1)}`, dias: new Date(y, m + 1, 0).getDate() };
  };
  const aprobadoSegun = (mv: MovDemo) => mv.aprobado && mv.offset <= -DIAS_HASTA_APROBAR;

  const cid = ctx.companyId;
  const C = (p: string) => `companies/${cid}/${p}`;
  const R = (col: string, key: string) => `${col}/${prefijoRaiz(cid)}${key}`;
  const docs: DocSeed[] = [];
  const put = (path: string, data: Record<string, unknown>) => docs.push({ path, data: sinUndefined(data) });

  const admins = ctx.miembros.filter((x) => x.role === 'Admin');
  const yo = admins[0] ?? ctx.miembros[0];
  const equipo = [yo, ...ctx.miembros.filter((x) => x !== yo)];
  const quien = (i: number) => equipo[i % equipo.length];

  /** Feed de actividad: [módulo, frase, offset, entidad, hh]. Se ordena y numera al final. */
  const feed: { modulo: Modulo; accion: string; offset: number; entidadId?: string; hh: number }[] = [];

  // --- Plantillas
  for (const p of PLANTILLAS) {
    const base = C(`casoPlantillas/${plantillaId(p.key)}`);
    put(base, {
      nombre: p.nombre, descripcion: p.descripcion, tipo: 'Civil',
      modeloCostos: { honorariosBase: p.honorariosBase },
      companyId: cid, createdAt: dia(-120), updatedAt: dia(-30),
    });
    p.hitos.forEach((h, i) => put(`${base}/hitos/${hitoPlantillaId(i)}`, { ...h, orden: i }));
    p.suplidos.forEach((s, i) => put(`${base}/modeloCostos/${i}`, { ...s, orden: i }));
  }

  // --- Facturas emitidas (colección raíz), numeradas tras la última real
  const ultimo = { ...ctx.ultimaFacturaPorAnio };
  const facturas = CASOS.flatMap((caso) => caso.facturas.map((fa) => ({ fa, caso })))
    .sort((a, b) => a.fa.offset - b.fa.offset);
  const facturaInfo = new Map<string, { id: string; total: number; status: string; contacto: number }>();
  for (const { fa, caso } of facturas) {
    const y = String(dia(fa.offset).getFullYear());
    ultimo[y] = (ultimo[y] ?? 0) + 1;
    const ci = caso.contactos[0];
    const contacto = CONTACTOS[ci];
    const d = contacto.type === 'persona_fisica' ? contacto.direccion : contacto.direccionSocial;
    const amount = r2(fa.lineas.reduce((s, [, b]) => s + b, 0));
    const vat = r2(amount * 0.21);
    const id = `${prefijoRaiz(cid)}${fa.key}`;
    facturaInfo.set(fa.key, { id, total: r2(amount + vat), status: fa.status, contacto: ci });
    put(`invoices/${id}`, {
      companyId: cid,
      invoiceNumber: `F-${y}-${pad(ultimo[y], 4)}`,
      amount, vat, total: r2(amount + vat),
      status: fa.status,
      issueDate: iso(fa.offset),
      dueDate: iso(fa.offset + fa.venceEn),
      paidDate: fa.status === 'pagada' ? iso(Math.min(fa.offset + 3, 0)) : undefined,
      casoId: casoId(caso.key), casoTitulo: caso.titulo,
      clienteNombre: nombreContacto(contacto),
      clienteNif: contacto.type === 'persona_fisica' ? contacto.nif : contacto.cif,
      clienteDireccion: `${d.calle} ${d.numero}${d.piso ? `, ${d.piso}` : ''}, ${d.codigoPostal} ${d.municipio}`,
      clienteTipoId: 'nif',
      clienteContactoId: contactoId(ci),
      lineas: fa.lineas.map(([concepto, b]) => ({ concepto, cantidad: 1, precioUnitario: b, base: b, aplicaIva: true, ivaRate: 0.21 })),
      ivaRate: 0.21,
      tipoFactura: 'F1',
      createdAt: dia(fa.offset, 10), updatedAt: dia(fa.offset, 10),
    });
  }

  // --- Casos, hitos, slots y gestoría
  const sembrados: MovSembrado[] = [];
  const hitosRecientes: { id: string; off: number; casoKey: string; titulo: string; uid: string }[] = [];
  let resumenCerrado: ResumenFinanciero | null = null;

  CASOS.forEach((caso, ci) => {
    const resp = quien(ci);
    const id = casoId(caso.key);
    const movId = (k: string) => `demo-mov-${caso.key}-${k}`;

    const plantilla = caso.plantilla ? PLANT.get(caso.plantilla) : undefined;
    const fuente: readonly HitoDemo[] = plantilla?.hitos ?? caso.hitos ?? [];
    let abierto = false;
    let completados = 0;
    fuente.forEach((h, i) => {
      const off = -caso.inicio + h.diasDesdeInicio;
      let estado: 'pendiente' | 'en_progreso' | 'completado' = 'pendiente';
      if (caso.estado === 'cerrado' || off < 0) estado = 'completado';
      else if (!abierto && caso.estado !== 'pendiente') { estado = 'en_progreso'; abierto = true; }
      const hitoId = `demo-hito-${caso.key}-${pad(i + 1)}`;
      const completado = estado === 'completado';
      const proximo = !completado && off >= 0 && off <= 10;
      const horas = (i % 3) + 1;
      if (completado) completados++;
      if (completado && off >= -30) hitosRecientes.push({ id: hitoId, off, casoKey: caso.key, titulo: h.titulo, uid: resp.uid });
      put(C(`hitos/${hitoId}`), {
        casoId: id, casoTitulo: caso.titulo,
        titulo: h.titulo, descripcion: h.descripcion,
        fechaEstimada: iso(off), fechaReal: completado ? iso(off) : undefined,
        asignadoA: resp.uid, asignadosA: [resp.uid],
        estado, orden: i,
        plantillaId: plantilla ? plantillaId(plantilla.key) : undefined,
        hitoPlantillaId: plantilla ? hitoPlantillaId(i) : undefined,
        horaAgenda: proximo ? HORAS_AGENDA[i % HORAS_AGENDA.length] : undefined,
        duracionAgenda: proximo ? 60 : undefined,
        registrosHoras: completado
          ? [
              { id: `${hitoId}-r1`, userId: resp.uid, fecha: iso(off), horaInicio: '09:00', horaFin: `${pad(9 + horas)}:00`, minutos: horas * 60, facturado: false },
              ...(off >= -21 ? [{ id: `${hitoId}-r2`, userId: resp.uid, fecha: iso(off), horaInicio: '16:00', horaFin: '17:30', minutos: 90, facturado: false }] : []),
            ]
          : undefined,
        anotaciones: estado === 'en_progreso'
          ? [{ id: `${hitoId}-n1`, texto: 'Pendiente de confirmar fecha con el juzgado.', autor: resp.uid, creadaEn: dia(-1, 13).toISOString() }]
          : undefined,
        createdBy: resp.uid, updatedBy: resp.uid,
        estadoActualizadoPor: estado !== 'pendiente' ? resp.uid : undefined,
        estadoActualizadoEn: estado !== 'pendiente' ? dia(Math.min(off, 0), 18).toISOString() : undefined,
      });
    });

    for (const mv of caso.movs) {
      const aprobado = aprobadoSegun(mv);
      put(C(`casos/${id}/gestoria/${movId(mv.key)}`), {
        casoId: id, companyId: cid, tipo: mv.tipo, concepto: mv.concepto, importe: mv.importe,
        esEntrada: mv.esEntrada, fecha: iso(mv.offset), cuentaId: CUENTAS[mv.cuenta].id,
        createdBy: resp.uid, createdAt: dia(mv.offset, 11),
        aprobado: aprobado || undefined,
        aprobadoAt: aprobado ? dia(Math.min(mv.offset + 1, 0), 9) : undefined,
        aprobadoPor: aprobado ? yo.uid : undefined,
        ...desglose(mv.importe, mv.iva),
      });
      sembrados.push({ ...mv, id: movId(mv.key), aprobadoAhora: aprobado, casoKey: caso.key });
    }

    let slotsTotal = 0;
    let registrados = 0;
    if (plantilla) {
      const slots = [
        { nombre: 'Honorarios base', tipoCosto: 'honorarios_base', importeEstimado: plantilla.honorariosBase as number | undefined, ivaIncluido: false as boolean | undefined },
        ...plantilla.suplidos.map((s) => ({ nombre: s.nombre, tipoCosto: s.tipo as string, importeEstimado: s.importeEstimado, ivaIncluido: undefined })),
      ];
      slotsTotal = slots.length;
      slots.forEach((s, i) => {
        const mv = caso.movs.find((x) => x.key === caso.slots[i]);
        if (mv) registrados++;
        put(C(`casos/${id}/gestoria_slots/slot-${pad(i)}`), {
          ...s, orden: i, status: mv ? 'registrado' : 'pendiente',
          movimientoId: mv ? movId(mv.key) : undefined,
          importeReal: mv?.importe, fechaRegistro: mv ? iso(mv.offset) : undefined,
          createdAt: dia(-caso.inicio), updatedAt: dia(mv ? mv.offset : -caso.inicio),
        });
      });
    }

    const resumenFinanciero = resumenDe(caso.movs);
    const facturaIds = caso.facturas.map((fa) => facturaInfo.get(fa.key)!.id);
    put(C(`casos/${id}`), {
      companyId: cid, titulo: caso.titulo, descripcion: caso.descripcion, tipo: 'Civil',
      estado: caso.estado, prioridad: caso.prioridad,
      contactoIds: caso.contactos.map(contactoId),
      plantillaId: plantilla ? plantillaId(plantilla.key) : undefined,
      resumenFinanciero,
      gestoriaResumenSlots: { total: slotsTotal, registrados },
      hitosResumen: { total: fuente.length, completados },
      facturaIds: facturaIds.length ? facturaIds : undefined,
      facturaId: facturaIds.at(-1),
      facturadoAt: caso.facturas.length ? dia(Math.min(...caso.facturas.map((fa) => fa.offset))).toISOString() : undefined,
      cierreConfirmadoAt: caso.cierre ? dia(-caso.cierre, 17).toISOString() : undefined,
      cierreSaldoBancario: caso.cierre ? resumenFinanciero.saldo : undefined,
      encargadoId: resp.uid,
      vencimiento: iso(caso.vence),
      createdBy: resp.uid, updatedBy: resp.uid,
      createdAt: dia(-caso.inicio, 9), updatedAt: dia(-1, 18),
    });
    if (caso.cierre) resumenCerrado = resumenFinanciero;
  });

  // Histórico de casos cerrados (en la app lo acumula confirmarCierre).
  const cerrado = resumenCerrado as ResumenFinanciero | null;
  if (cerrado) {
    put(C('tesoreria_meta/resumen'), {
      totalIngresosCerrados: cerrado.totalIngresos,
      totalSuplidosCerrados: cerrado.totalSuplidos,
      totalHonorariosCerrados: cerrado.totalHonorarios,
      totalEgresosCerrados: cerrado.totalEgresos,
      saldoCerrados: cerrado.saldo,
      casosCount: 1,
      ultimaActualizacion: dia(-35, 17),
    });
  }

  // --- Movimientos generales: apertura + recurrentes de 6 meses + puntuales
  const facturasRecibidas: FacturaRecibidaSeed[] = [];
  const registrarRecibida = (mv: MovDemo, movimientoId: string, proveedor: ProveedorDemo, numero: string, categoria: string) => {
    const fecha = dia(mv.offset);
    const ejercicio = fecha.getFullYear();
    const id = claveFactura(proveedor.nif, numero);
    const { baseImponible, cuotaIva, tipoIva } = desglose(mv.importe, mv.iva);
    facturasRecibidas.push({
      id, ejercicio,
      data: {
        companyId: cid, tipoFactura: 'F1', claveOperacion: '01',
        proveedor: { ...proveedor, pais: 'ES' }, numero,
        fechaExpedicion: iso(mv.offset - 1), fechaOperacion: iso(mv.offset - 1), fechaRegistro: iso(mv.offset),
        periodo303: { ejercicio, trimestre: Math.floor(fecha.getMonth() / 3) + 1 },
        lineasIva: [{ base: baseImponible, tipo: tipoIva, cuota: cuotaIva }],
        total: mv.importe, porcentajeDeducible: 100, concepto: mv.concepto, categoria,
        qrValidacion: { estado: 'sin_qr' },
        extraccion: { origen: 'manual', discrepancias: [] },
        movimientoId, estado: 'registrada',
      },
    });
    return id;
  };
  const general = (mv: MovDemo, id: string, frId?: string) => {
    const aprobado = aprobadoSegun(mv);
    put(C(`movimientos_generales/${id}`), {
      companyId: cid, tipo: mv.tipo, concepto: mv.concepto, importe: mv.importe, esEntrada: mv.esEntrada,
      fecha: iso(mv.offset), cuentaId: CUENTAS[mv.cuenta].id,
      createdBy: yo.uid, createdAt: dia(mv.offset, 10),
      aprobado: aprobado || undefined,
      aprobadoAt: aprobado ? dia(Math.min(mv.offset + 1, 0), 9) : undefined,
      aprobadoPor: aprobado ? yo.uid : undefined,
      facturaRecibidaId: frId,
      ...desglose(mv.importe, mv.iva),
    });
    sembrados.push({ ...mv, id, aprobadoAhora: aprobado });
  };

  for (const [k, cu] of Object.entries(CUENTAS) as [CuentaDemo, (typeof CUENTAS)[CuentaDemo]][]) {
    general(
      { key: `apertura-${k}`, tipo: 'ajuste', concepto: `Saldo de apertura — ${cu.nombre}`, importe: cu.apertura, esEntrada: true, offset: -APERTURA_HACE, iva: 0, cuenta: k, aprobado: true },
      `demo-mg-apertura-${k}`,
    );
  }
  for (let k = 5; k >= 0; k--) {
    const mes = mesAtras(k);
    for (const r of RECURRENTES) {
      if (r.trimestral && mes.m % 3 !== 0) continue;
      const offset = offsetDe(mes.y, mes.m, Math.min(r.dia, mes.dias));
      if (offset > 0) continue;
      const mv: MovDemo = {
        key: `${r.key}-${mes.sufijo}`, tipo: r.tipo, concepto: r.concepto.replace('{mes}', mes.label),
        importe: r.importe, esEntrada: r.esEntrada, offset, iva: r.iva, cuenta: r.cuenta, aprobado: true,
      };
      const id = `demo-mg-${mv.key}`;
      const frId = r.recibida
        ? registrarRecibida(mv, id, r.recibida.proveedor, `${r.recibida.prefijo}-${mes.sufijo}`, r.recibida.categoria)
        : undefined;
      general(mv, id, frId);
    }
  }
  for (const p of PUNTUALES) {
    const id = `demo-mg-${p.key}`;
    const frId = p.recibida
      ? registrarRecibida(p, id, p.recibida.proveedor, p.recibida.numero(dia(p.offset).getFullYear()), p.recibida.categoria)
      : undefined;
    general(p, id, frId);
  }

  // Retiros del titular: no son movimientos de cuenta en la app (no entran en saldos).
  for (let k = 1; k <= RETIRO_MENSUAL.meses; k++) {
    const mes = mesAtras(k);
    const offset = offsetDe(mes.y, mes.m, RETIRO_MENSUAL.dia);
    put(C(`retiros/demo-retiro-${mes.sufijo}`), {
      companyId: cid, concepto: RETIRO_MENSUAL.concepto.replace('{mes}', mes.label), importe: RETIRO_MENSUAL.importe,
      fecha: iso(offset), cuentaId: CUENTAS.santander.id, notas: 'Transferencia a cuenta personal',
      createdBy: yo.uid, createdAt: dia(offset, 9),
    });
  }

  // --- Cuentas + extracto bancario (60 días)
  const signo = (mv: MovDemo) => (mv.esEntrada ? mv.importe : -mv.importe);
  const VENTANA_EXTRACTO = 60;
  for (const [k, cu] of Object.entries(CUENTAS) as [CuentaDemo, (typeof CUENTAS)[CuentaDemo]][]) {
    const movs = sembrados.filter((mv) => mv.cuenta === k).sort((a, b) => a.offset - b.offset);
    let saldo: number;

    if (cu.tipo === 'banco') {
      saldo = r2(movs.filter((mv) => mv.offset < -VENTANA_EXTRACTO).reduce((s, mv) => s + signo(mv), 0));
      const lineas = [
        ...movs
          .filter((mv) => mv.offset >= -VENTANA_EXTRACTO && mv.offset <= -DIAS_HASTA_BANCO)
          .map((mv) => ({
            concepto: (mv.esEntrada ? 'ABONO — ' : 'CARGO — ') + mv.concepto.toUpperCase(),
            importe: signo(mv), offset: mv.offset,
            estado: mv.aprobadoAhora ? 'casado' : 'pendiente',
            movimientoId: mv.aprobadoAhora ? mv.id : undefined,
          })),
        ...(EXTRACTO_SUELTO[k] ?? []).map((e) => ({ ...e, estado: 'pendiente', movimientoId: undefined })),
      ].sort((a, b) => a.offset - b.offset);
      lineas.forEach((l, i) => {
        saldo = r2(saldo + l.importe);
        put(C(`cuentas/${cu.id}/extracto/demo-linea-${pad(i + 1, 3)}`), {
          cuentaId: cu.id, companyId: cid, fecha: iso(l.offset), concepto: l.concepto, importe: r2(l.importe),
          saldoPosterior: saldo, estado: l.estado, movimientoId: l.movimientoId,
          importadoPor: yo.uid, importadoAt: dia(-1, 8),
        });
      });
    } else {
      // Caja: el saldo "real" es el arqueo, que coincide con lo aprobado.
      saldo = r2(movs.filter((mv) => mv.aprobadoAhora).reduce((s, mv) => s + signo(mv), 0));
    }

    put(C(`cuentas/${cu.id}`), {
      companyId: cid, nombre: cu.nombre, tipo: cu.tipo, entidad: cu.entidad, iban: cu.iban,
      saldoBancario: saldo, saldoBancarioFecha: iso(-1), activa: true,
      createdAt: dia(-APERTURA_HACE), updatedAt: dia(-1, 8),
    });
  }

  // --- Cierres de caja: fin de los 3 meses anteriores + la semana pasada
  const fechasCierre = [3, 2, 1]
    .map((k) => { const mes = mesAtras(k); return { offset: offsetDe(mes.y, mes.m, mes.dias), notas: `Cierre de ${mes.label}. Conciliado con el extracto bancario.` }; })
    .concat([{ offset: -7, notas: 'Cierre semanal. Descuadre de 12,40 € en caja: ticket de parking sin registrar.' }])
    .filter((c, i, arr) => arr.findIndex((x) => x.offset === c.offset) === i);
  fechasCierre.forEach(({ offset, notas }, ci) => {
    const ultimoCierre = ci === fechasCierre.length - 1;
    const cuentas = (Object.entries(CUENTAS) as [CuentaDemo, (typeof CUENTAS)[CuentaDemo]][]).map(([k, cu]) => {
      const hasta = sembrados.filter((mv) => mv.cuenta === k && mv.offset <= offset);
      const ingresos = r2(hasta.filter((mv) => mv.esEntrada).reduce((s, mv) => s + mv.importe, 0));
      const egresos = r2(hasta.filter((mv) => !mv.esEntrada).reduce((s, mv) => s + mv.importe, 0));
      const aprobado = r2(hasta.filter((mv) => mv.aprobadoAhora).reduce((s, mv) => s + signo(mv), 0));
      const descuadre = ultimoCierre && cu.tipo === 'caja' ? -12.4 : 0;
      return {
        cuentaId: cu.id, nombre: cu.nombre, tipo: cu.tipo, ingresos, egresos,
        sistema: r2(ingresos - egresos), aprobado,
        saldoReal: r2(aprobado + descuadre), diferencia: descuadre, conciliado: descuadre === 0,
      };
    });
    const suma = (key: 'ingresos' | 'egresos' | 'sistema' | 'aprobado') => r2(cuentas.reduce((s, c) => s + c[key], 0));
    put(C(`cierres_caja/demo-cierre-${iso(offset).replaceAll('-', '')}`), {
      fecha: iso(offset), companyId: cid, creadoPor: yo.uid, creadoAt: dia(offset, 19), notas, cuentas,
      totales: { ingresos: suma('ingresos'), egresos: suma('egresos'), sistemaTotal: suma('sistema'), aprobadoTotal: suma('aprobado') },
    });
    feed.push({ modulo: 'Tesorería', accion: `Cerró la caja del ${iso(offset).split('-').reverse().join('/')}`, offset, hh: 19 });
  });

  // --- Contactos (proyectos activos y facturado real)
  CONTACTOS.forEach((c, i) => {
    const { alta, ultimoContacto, ...data } = c;
    const resp = quien(i);
    const facturado = [...facturaInfo.values()].filter((fi) => fi.contacto === i && fi.status === 'pagada');
    put(C(`contactos/${contactoId(i)}`), {
      ...data,
      companyId: cid,
      assignedTo: resp.uid,
      activeProjects: CASOS.filter((k) => k.contactos.includes(i) && k.estado !== 'cerrado').length,
      totalBilled: r2(facturado.reduce((s, fi) => s + fi.total, 0)),
      lastContact: dia(-ultimoContacto, 11),
      createdBy: resp.uid, updatedBy: resp.uid,
      createdAt: dia(-alta, 10), updatedAt: dia(-ultimoContacto, 11),
    });
  });

  // --- Agenda
  const lunesHace4Semanas = (() => {
    const d = dia(-28);
    return -28 - ((d.getDay() + 6) % 7) + 7;
  })();
  EVENTOS.forEach((e, i) => {
    const resp = quien(i);
    const off = e.offset === 'lunes' ? lunesHace4Semanas : e.offset;
    put(C(`eventos/demo-evento-${pad(i + 1)}`), {
      companyId: cid, titulo: e.titulo, lugar: e.lugar, link: e.link,
      fecha: iso(off), horaInicio: e.horas?.[0], horaFin: e.horas?.[1], todoDia: !e.horas,
      estado: e.estado, recurrencia: e.recurrencia ?? 'ninguna', prioridad: e.prioridad, color: e.color,
      invitados: [resp.uid], creadoPor: resp.uid, updatedBy: resp.uid,
      createdAt: dia(Math.min(off, 0) - 3), updatedAt: dia(Math.min(off, 0) - 1),
    });
  });
  SEGUIMIENTOS.forEach((s, i) => {
    const resp = s.responsable === 0 ? yo : quien(s.responsable);
    put(C(`eventos/demo-evento-seguimiento-${pad(i + 1)}`), {
      companyId: cid, titulo: s.titulo, fecha: iso(s.offset), todoDia: true,
      estado: s.estado, recurrencia: 'ninguna', prioridad: 'alta', color: 'amarillo',
      invitados: [resp.uid], responsableId: resp.uid, entregable: s.entregable,
      origen: {
        tipo: 'seguimiento_contacto', contactoId: contactoId(s.contacto), contactoNombre: nombreContacto(CONTACTOS[s.contacto]),
        statusOrigen: s.desde, statusDestino: s.hasta,
      },
      creadoPor: resp.uid, updatedBy: resp.uid, createdAt: dia(Math.min(s.offset, 0) - 4, 18), updatedAt: dia(Math.min(s.offset, 0) - 4, 18),
    });
  });

  // --- Recepción IA: agente, llamadas y leads
  const { agentId } = ctx.agente;
  if (ctx.agente.crear) {
    put(`agentMappings/${agentId}`, { agentId, companyId: cid, label: 'Recepción IA (demo)', createdAt: dia(-90), updatedAt: dia(-90) });
  }
  for (const ll of LLAMADAS) {
    const [hh, mm] = ll.hora.split(':').map(Number);
    const id = `${prefijoRaiz(cid)}llamada-${ll.key}`;
    put(`llamadas/${id}`, {
      conversationId: id,
      agentId,
      estado: ll.estado,
      duracionSegundos: ll.turnos.length * 23 + 11,
      resumen: ll.resumen,
      tituloResumen: ll.titulo,
      transcripcion: ll.turnos.map(([rol, mensaje], i) => ({ rol: rol === 'a' ? 'agente' : 'usuario', mensaje, segundosEnLlamada: i * 23 })),
      exitosa: ll.estado === 'completada',
      datosCapturados: {
        nombreCliente: ll.nombre, telefono: ll.telefono, especialidadJuridica: ll.especialidad,
        nivelUrgencia: ll.urgencia, descripcionCaso: ll.descripcion,
      },
      creadoEn: dia(-ll.hace, hh, mm),
      contactId: ll.contacto !== undefined ? contactoId(ll.contacto) : undefined,
    });
    feed.push({ modulo: 'RecepciónIA', accion: `Revisó la llamada de ${ll.nombre ?? ll.telefono}`, offset: -ll.hace, hh: Math.min(hh + 1, 20) });
  }
  for (const l of LEADS) {
    put(R('iaContacts', `lead-${l.key}`), {
      companyId: cid, contactType: l.tipo, contactDate: iso(-l.hace), contactTime: l.hora,
      clientName: l.nombre, category: l.categoria, description: l.descripcion, urgency: l.urgencia,
      score: l.score, status: l.status, clientPhone: l.telefono, clientEmail: l.email, clientCompany: l.empresa,
      duration: l.duracion, assignedToId: l.status === 'en_proceso' ? yo.uid : undefined,
      createdAt: dia(-l.hace, 9), updatedAt: dia(-l.hace, 9),
    });
  }

  // --- Acciones + historial de ejecuciones
  for (const a of ACCIONES) {
    put(C(`acciones/demo-accion-${a.key}`), {
      companyId: cid, nombre: a.nombre, ambito: a.ambito, asunto: a.asunto, cuerpo: a.cuerpo, canales: a.canales,
      activa: true,
      plantillaId: a.plantilla ? plantillaId(a.plantilla) : undefined,
      hitoPlantillaId: a.hitoPlantillaId,
      createdBy: yo.uid, createdAt: dia(-90), updatedAt: dia(-20),
    });
  }
  REGISTROS_ACCION.forEach(([acc, ci, caso, canal, hace], i) => {
    put(C(`accion_registros/demo-registro-${pad(i + 1)}`), {
      companyId: cid, accionId: `demo-accion-${acc}`, accionNombre: ACCIONES.find((a) => a.key === acc)!.nombre,
      contactoIds: [contactoId(ci)], casoId: caso ? casoId(caso) : undefined, canal,
      createdBy: quien(i).uid, createdAt: dia(-hace, 11, 15),
    });
  });

  // --- Feed de actividad de hitos y de la empresa
  for (const h of hitosRecientes) {
    put(C(`hito_actividad/demo-ha-${h.id}`), {
      casoId: casoId(h.casoKey), hitoId: h.id, hitoTitulo: h.titulo, tipo: 'estado',
      autorId: h.uid, estadoAnterior: 'en_progreso', estadoNuevo: 'completado', createdAt: dia(h.off, 18),
    });
    if (h.off >= -21) feed.push({ modulo: 'Casos', accion: `Completó el hito "${h.titulo}"`, offset: h.off, entidadId: casoId(h.casoKey), hh: 18 });
  }
  for (const mv of sembrados) {
    if (mv.offset < -21) continue;
    feed.push({
      modulo: 'Tesorería', accion: `Registró el movimiento "${mv.concepto}" (${euros(mv.importe)} €)`,
      offset: mv.offset, entidadId: mv.casoKey ? casoId(mv.casoKey) : undefined, hh: 10,
    });
  }
  for (const [modulo, accion, hace, entidad] of ACTIVIDAD) {
    const entidadId = !entidad ? undefined
      : entidad.startsWith('contacto:') ? contactoId(Number(entidad.split(':')[1]))
      : casoId(entidad);
    feed.push({ modulo, accion, offset: -hace, entidadId, hh: 12 });
  }
  feed
    .sort((a, b) => b.offset - a.offset || b.hh - a.hh || a.accion.localeCompare(b.accion))
    .slice(0, 80)
    .forEach((f, i) => {
      const a = quien(i);
      put(C(`actividad/demo-act-${pad(i + 1, 3)}`), {
        companyId: cid, autorId: a.uid, autorNombre: a.nombre, accion: f.accion, modulo: f.modulo, entidadId: f.entidadId,
        createdAt: dia(f.offset, f.hh, (i * 7) % 60),
      });
    });

  return { docs, facturasRecibidas };
}

/** Colecciones append-only por rules (`allow update: if false`): re-escribir un doc existente falla. */
export const COLECCIONES_SOLO_CREAR = ['accion_registros'] as const;

/**
 * Qué escribir y en qué lotes: descarta los docs de colecciones append-only que
 * ya existen (`existentes` = paths) y trocea el resto en lotes de `tamanio`.
 */
export function planDeEscritura(
  docs: readonly DocSeed[],
  existentes: ReadonlySet<string>,
  tamanio: number,
): { lotes: DocSeed[][]; omitidos: number } {
  const pendientes = docs.filter((d) => !existentes.has(d.path));
  const lotes: DocSeed[][] = [];
  for (let i = 0; i < pendientes.length; i += tamanio) lotes.push(pendientes.slice(i, i + tamanio));
  return { lotes, omitidos: docs.length - pendientes.length };
}

/**
 * Docs demo (id `demo-…`) de cargas anteriores que ya no forman parte del seed
 * (p. ej. cuentas renombradas). Nunca devuelve docs sin prefijo demo: los datos
 * reales de la empresa no se tocan.
 */
export function pathsObsoletos(existentes: readonly string[], seed: readonly DocSeed[]): string[] {
  const vigentes = new Set(seed.map((d) => d.path));
  return existentes.filter((p) => p.split('/').pop()!.startsWith('demo-') && !vigentes.has(p));
}

/** Resumen legible por colección (para la UI). */
export function contarPorColeccion(docs: readonly DocSeed[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { path } of docs) {
    const partes = path.split('/');
    const col = partes[partes.length - 2];
    out[col] = (out[col] ?? 0) + 1;
  }
  return out;
}
