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
 */
import { desglosarIva, type TipoIva } from '../../interfaces/iva';
import { RESUMEN_FINANCIERO_VACIO, type ResumenFinanciero } from '../../interfaces/caso.interface';
import { claveFactura } from '../facturas-recibidas/clave-factura';
import {
  ACCIONES, ACTIVIDAD, CASOS, CONTACTOS, CUENTAS, EVENTOS, EXTRACTO_SUELTO, GENERALES, PLANTILLAS,
  RECIBIDAS, REGISTROS_ACCION, RETIROS,
  type ContactoDemo, type CuentaDemo, type HitoDemo, type MovDemo,
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

/** Prefijo de los ids de facturas demo en la colección raíz `invoices`. */
export const prefijoFacturaDemo = (companyId: string) => `demo-${companyId}-`;

export function ultimaFacturaPorAnio(
  facturas: readonly { id: string; invoiceNumber?: string }[],
  companyId: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const fa of facturas) {
    if (fa.id.startsWith(prefijoFacturaDemo(companyId))) continue;
    const mt = /^F-(\d{4})-(\d+)$/.exec(fa.invoiceNumber ?? '');
    if (mt) out[mt[1]] = Math.max(out[mt[1]] ?? 0, Number(mt[2]));
  }
  return out;
}

// ---------------------------------------------------------------------------

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

  const cid = ctx.companyId;
  const C = (p: string) => `companies/${cid}/${p}`;
  const docs: DocSeed[] = [];
  const put = (path: string, data: Record<string, unknown>) => docs.push({ path, data: sinUndefined(data) });

  const admins = ctx.miembros.filter((x) => x.role === 'Admin');
  const yo = admins[0] ?? ctx.miembros[0];
  const equipo = [yo, ...ctx.miembros.filter((x) => x !== yo)];
  const quien = (i: number) => equipo[i % equipo.length];

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
    const id = `${prefijoFacturaDemo(cid)}${fa.key}`;
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
  const movsPorCuenta: (MovDemo & { id: string | null; retiro?: boolean })[] = [];
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
      put(C(`casos/${id}/gestoria/${movId(mv.key)}`), {
        casoId: id, companyId: cid, tipo: mv.tipo, concepto: mv.concepto, importe: mv.importe,
        esEntrada: mv.esEntrada, fecha: iso(mv.offset), cuentaId: CUENTAS[mv.cuenta].id,
        createdBy: resp.uid, createdAt: dia(mv.offset, 11),
        aprobado: mv.aprobado,
        aprobadoAt: mv.aprobado ? dia(Math.min(mv.offset + 1, 0), 9) : undefined,
        aprobadoPor: mv.aprobado ? yo.uid : undefined,
        ...desglose(mv.importe, mv.iva),
      });
      movsPorCuenta.push({ ...mv, id: movId(mv.key) });
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

  // --- Gastos generales del despacho + facturas recibidas
  const facturasRecibidas: FacturaRecibidaSeed[] = [];
  for (const mv of GENERALES) {
    const id = `demo-mg-${mv.key}`;
    const rec = RECIBIDAS[mv.key];
    let frId: string | undefined;
    if (rec) {
      const fecha = dia(mv.offset);
      const ejercicio = fecha.getFullYear();
      const numero = rec.numero(ejercicio);
      frId = claveFactura(rec.proveedor.nif, numero);
      const { baseImponible, cuotaIva, tipoIva } = desglose(mv.importe, mv.iva);
      facturasRecibidas.push({
        id: frId, ejercicio,
        data: {
          companyId: cid, tipoFactura: 'F1', claveOperacion: '01',
          proveedor: { ...rec.proveedor, pais: 'ES' }, numero,
          fechaExpedicion: iso(mv.offset - 1), fechaOperacion: iso(mv.offset - 1), fechaRegistro: iso(mv.offset),
          periodo303: { ejercicio, trimestre: Math.floor(fecha.getMonth() / 3) + 1 },
          lineasIva: [{ base: baseImponible, tipo: tipoIva, cuota: cuotaIva }],
          total: mv.importe, porcentajeDeducible: 100, concepto: mv.concepto, categoria: rec.categoria,
          qrValidacion: { estado: 'sin_qr' },
          extraccion: { origen: 'manual', discrepancias: [] },
          movimientoId: id, estado: 'registrada',
        },
      });
    }
    put(C(`movimientos_generales/${id}`), {
      companyId: cid, tipo: mv.tipo, concepto: mv.concepto, importe: mv.importe, esEntrada: mv.esEntrada,
      fecha: iso(mv.offset), cuentaId: CUENTAS[mv.cuenta].id,
      createdBy: yo.uid, createdAt: dia(mv.offset, 10),
      aprobado: mv.aprobado,
      aprobadoAt: mv.aprobado ? dia(Math.min(mv.offset + 1, 0), 9) : undefined,
      aprobadoPor: mv.aprobado ? yo.uid : undefined,
      facturaRecibidaId: frId,
      ...desglose(mv.importe, mv.iva),
    });
    movsPorCuenta.push({ ...mv, id });
  }

  for (const r of RETIROS) {
    put(C(`retiros/demo-retiro-${r.key}`), {
      companyId: cid, concepto: r.concepto, importe: r.importe, fecha: iso(r.offset),
      cuentaId: CUENTAS.operativa.id, notas: 'Transferencia a cuenta personal', createdBy: yo.uid, createdAt: dia(r.offset, 9),
    });
    movsPorCuenta.push({
      key: r.key, tipo: 'otro', concepto: r.concepto, importe: r.importe, esEntrada: false,
      offset: r.offset, iva: 0, cuenta: 'operativa', aprobado: true, id: null, retiro: true,
    });
  }

  // --- Cuentas + extracto bancario (40 días) + cierre de caja
  const signo = (mv: MovDemo) => (mv.esEntrada ? mv.importe : -mv.importe);
  const cierreCuentas: Record<string, unknown>[] = [];
  const totales = { ingresos: 0, egresos: 0, sistemaTotal: 0, aprobadoTotal: 0 };
  for (const [k, cu] of Object.entries(CUENTAS) as [CuentaDemo, (typeof CUENTAS)[CuentaDemo]][]) {
    const movs = movsPorCuenta.filter((mv) => mv.cuenta === k).sort((a, b) => a.offset - b.offset);
    let saldo = r2(cu.inicial + movs.filter((mv) => mv.offset < -40).reduce((s, mv) => s + signo(mv), 0));
    const recientes = movs.filter((mv) => mv.offset >= -40);

    if (cu.tipo === 'banco') {
      const lineas = [
        ...recientes.map((mv) => ({
          concepto: (mv.retiro ? 'TRANSFERENCIA EMITIDA — ' : mv.esEntrada ? 'ABONO — ' : 'CARGO — ') + mv.concepto.toUpperCase(),
          importe: signo(mv),
          offset: mv.offset,
          estado: mv.retiro ? 'ignorado' : mv.offset <= -4 ? 'casado' : 'pendiente',
          movimientoId: !mv.retiro && mv.offset <= -4 ? mv.id ?? undefined : undefined,
        })),
        ...(EXTRACTO_SUELTO[k] ?? []).map((e) => ({ ...e, estado: 'pendiente', movimientoId: undefined })),
      ].sort((a, b) => a.offset - b.offset);
      lineas.forEach((l, i) => {
        saldo = r2(saldo + l.importe);
        put(C(`cuentas/${cu.id}/extracto/demo-linea-${pad(i + 1)}`), {
          cuentaId: cu.id, companyId: cid, fecha: iso(l.offset), concepto: l.concepto, importe: r2(l.importe),
          saldoPosterior: saldo, estado: l.estado, movimientoId: l.movimientoId,
          importadoPor: yo.uid, importadoAt: dia(-1, 8),
        });
      });
    } else {
      saldo = r2(saldo + recientes.reduce((s, mv) => s + signo(mv), 0));
    }

    put(C(`cuentas/${cu.id}`), {
      companyId: cid, nombre: cu.nombre, tipo: cu.tipo, entidad: cu.entidad, iban: cu.iban,
      saldoBancario: saldo, saldoBancarioFecha: iso(-1), activa: true,
      createdAt: dia(-240), updatedAt: dia(-1, 8),
    });

    const hastaCierre = movs.filter((mv) => mv.offset <= -7);
    const ventana = hastaCierre.filter((mv) => mv.offset >= -37);
    const sistema = r2(cu.inicial + hastaCierre.reduce((s, mv) => s + signo(mv), 0));
    const aprobado = r2(cu.inicial + hastaCierre.filter((mv) => mv.aprobado).reduce((s, mv) => s + signo(mv), 0));
    const ingresos = r2(ventana.filter((mv) => mv.esEntrada).reduce((s, mv) => s + mv.importe, 0));
    const egresos = r2(ventana.filter((mv) => !mv.esEntrada).reduce((s, mv) => s + mv.importe, 0));
    totales.ingresos = r2(totales.ingresos + ingresos);
    totales.egresos = r2(totales.egresos + egresos);
    totales.sistemaTotal = r2(totales.sistemaTotal + sistema);
    totales.aprobadoTotal = r2(totales.aprobadoTotal + aprobado);
    cierreCuentas.push({
      cuentaId: cu.id, nombre: cu.nombre, tipo: cu.tipo, ingresos, egresos,
      sistema, aprobado, saldoReal: sistema, diferencia: 0, conciliado: true,
    });
  }
  put(C('cierres_caja/demo-cierre-01'), {
    fecha: iso(-7), companyId: cid, creadoPor: yo.uid, creadoAt: dia(-7, 19),
    notas: 'Cierre mensual. Todo cuadrado con los extractos.',
    cuentas: cierreCuentas, totales,
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
  const respSeguimiento = quien(3);
  put(C('eventos/demo-evento-seguimiento-01'), {
    companyId: cid, titulo: 'Enviar presupuesto a Antonio Pérez Gómez', fecha: iso(2), todoDia: true,
    estado: 'confirmado', recurrencia: 'ninguna', prioridad: 'alta', color: 'amarillo',
    invitados: [respSeguimiento.uid], responsableId: respSeguimiento.uid, entregable: 'Presupuesto y hoja de encargo',
    origen: {
      tipo: 'seguimiento_contacto', contactoId: contactoId(3), contactoNombre: nombreContacto(CONTACTOS[3]),
      statusOrigen: 'potencial', statusDestino: 'pendiente_presupuesto',
    },
    creadoPor: respSeguimiento.uid, updatedBy: respSeguimiento.uid, createdAt: dia(-4, 18), updatedAt: dia(-4, 18),
  });

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
  }
  ACTIVIDAD.forEach(([modulo, accion, hace, entidad], i) => {
    const a = quien(i);
    const entidadId = !entidad ? undefined
      : entidad.startsWith('contacto:') ? contactoId(Number(entidad.split(':')[1]))
      : casoId(entidad);
    put(C(`actividad/demo-act-${pad(i + 1)}`), {
      companyId: cid, autorId: a.uid, autorNombre: a.nombre, accion, modulo, entidadId,
      createdAt: dia(-hace, 9 + (i % 8), (i * 7) % 60),
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


