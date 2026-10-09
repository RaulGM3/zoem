import { describe, expect, it } from 'vitest';
import { decidirCuotaArchivo, parseRutaArchivo } from './cuotaArchivos';

const MB = 1_048_576;

describe('parseRutaArchivo', () => {
  it('archivos de caso: companies/{cid}/casos/{casoId}/docs/...', () => {
    expect(parseRutaArchivo('companies/c1/casos/k9/docs/root/17_a.pdf')).toEqual({ tipo: 'caso', cid: 'c1', casoId: 'k9' });
    expect(parseRutaArchivo('companies/c1/casos/k9/docs/carpeta/sub/a.pdf')).toEqual({ tipo: 'caso', cid: 'c1', casoId: 'k9' });
  });
  it('archivos de contacto: companies/{cid}/contacts/{contactId}/...', () => {
    expect(parseRutaArchivo('companies/c1/contacts/ct1/root/17_a.pdf')).toEqual({ tipo: 'contacto', cid: 'c1', contactId: 'ct1' });
  });
  it('el resto de rutas no cuenta para la cuota', () => {
    for (const r of [
      'companies/c1/facturas_recibidas/f.pdf', 'companies/c1/branding/logo', 'companies/c1/acciones_envios/r.docx',
      'companies/c1/invoices/i.pdf', 'companies/c1/docTemplates/t/a.html', 'companies/c1/casos/k9/otra/a.pdf',
      'companies/c1/casos/k9/docs', 'companies/c1/contacts', 'otra/c1/contacts/ct1/a', '',
    ]) expect(parseRutaArchivo(r), r).toBeNull();
  });
});

describe('decidirCuotaArchivo', () => {
  const base = { usadoBytes: 0, tamano: 10, contado: false, limiteMB: 1 as number | null };

  it('sin límite (null) siempre se conserva', () => {
    expect(decidirCuotaArchivo({ ...base, limiteMB: null, usadoBytes: 999 * MB }).accion).toBe('conservar');
  });
  it('si no cuenta como "contado" se suma su tamaño al uso', () => {
    expect(decidirCuotaArchivo({ ...base, usadoBytes: MB - 10 }).accion).toBe('conservar'); // justo cabe
    const d = decidirCuotaArchivo({ ...base, usadoBytes: MB - 9 });
    expect(d.accion).toBe('eliminar');
    expect(d).toMatchObject({ usadoBytes: MB - 9 + 10, limiteBytes: MB });
  });
  it('si ya está contado (hay doc de metadatos) NO se suma otra vez', () => {
    expect(decidirCuotaArchivo({ ...base, contado: true, usadoBytes: MB }).accion).toBe('conservar');
    expect(decidirCuotaArchivo({ ...base, contado: true, usadoBytes: MB + 1 }).accion).toBe('eliminar');
  });
  it('límite 0 MB: nada cabe', () => {
    expect(decidirCuotaArchivo({ ...base, limiteMB: 0 }).accion).toBe('eliminar');
  });
  it('archivo vacío en cupo agotado exacto se conserva', () => {
    expect(decidirCuotaArchivo({ ...base, tamano: 0, usadoBytes: MB }).accion).toBe('conservar');
  });
});
