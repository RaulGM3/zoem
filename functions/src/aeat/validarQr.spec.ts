import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { crearConsulta, MAX_BYTES } from './validarQrFetch';
import { manejarValidarQr, validarEntrada } from './validarQr';
import type { ValidarQrDeps } from './validarQr';

const fixture = (n: string): string => readFileSync(join(__dirname, 'testing', n), 'utf8');
const URL_OK = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B12345674&numserie=A-1&fecha=01-02-2026&importe=10.50';

interface Escritura {
  companyId: string;
  facturaId: string;
  estado: string;
  urlConsulta: string;
  mensaje?: string;
}

function entorno(over: { qrUrl?: string | null; existe?: boolean; html?: string; status?: number; falla?: boolean } = {}) {
  const escrituras: Escritura[] = [];
  const consultas: string[] = [];
  const deps: ValidarQrDeps = {
    async leerFactura() {
      if (over.existe === false) return null;
      return { qrUrl: over.qrUrl === undefined ? URL_OK : over.qrUrl };
    },
    async consultar(url) {
      consultas.push(url);
      if (over.falla) throw new Error('boom');
      return { status: over.status ?? 200, html: over.html ?? fixture('validarqr-sintetica-encontrada.html') };
    },
    async guardar(companyId, facturaId, r) {
      escrituras.push({ companyId, facturaId, ...r });
    },
  };
  const autorizar = vi.fn(async (_uid: string, _companyId: string) => {});
  return { deps, escrituras, consultas, autorizar };
}

const DATA = { companyId: 'co1', facturaId: 'f1' };

describe('validarEntrada', () => {
  it.each([[undefined], [null], [{}], [{ companyId: 'c' }], [{ companyId: '', facturaId: 'f' }], [{ companyId: 1, facturaId: 'f' }]])(
    'rechaza %j',
    (data) => {
      expect(() => validarEntrada(data)).toThrowError(HttpsError);
    },
  );
  it('acepta {companyId, facturaId}', () => {
    expect(validarEntrada({ ...DATA, extra: 'x' })).toEqual(DATA);
  });
});

describe('manejarValidarQr', () => {
  it('sin uid -> unauthenticated, sin tocar nada', async () => {
    const e = entorno();
    await expect(manejarValidarQr(e.deps, e.autorizar, undefined, DATA)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(e.consultas).toHaveLength(0);
    expect(e.autorizar).not.toHaveBeenCalled();
  });

  it('no manager -> permission-denied, ni lee ni consulta ni escribe', async () => {
    const e = entorno();
    e.autorizar.mockRejectedValue(new HttpsError('permission-denied', 'No autorizado para esta empresa'));
    await expect(manejarValidarQr(e.deps, e.autorizar, 'u1', DATA)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(e.consultas).toHaveLength(0);
    expect(e.escrituras).toHaveLength(0);
  });

  it('autoriza con la empresa pedida', async () => {
    const e = entorno();
    await manejarValidarQr(e.deps, e.autorizar, 'u1', DATA);
    expect(e.autorizar).toHaveBeenCalledWith('u1', 'co1');
  });

  it('factura inexistente -> not-found', async () => {
    const e = entorno({ existe: false });
    await expect(manejarValidarQr(e.deps, e.autorizar, 'u1', DATA)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('factura sin QR -> failed-precondition, no se consulta', async () => {
    const e = entorno({ qrUrl: null });
    await expect(manejarValidarQr(e.deps, e.autorizar, 'u1', DATA)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(e.consultas).toHaveLength(0);
  });

  it.each([
    ['host ajeno', 'https://evil.example.com/wlpl/TIKE-CONT/ValidarQR?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
    ['metadata interna', 'http://169.254.169.254/latest/meta-data'],
    ['ruta ajena', 'https://prewww2.aeat.es/admin?nif=B1&numserie=A&fecha=01-02-2026&importe=1'],
  ])('SSRF: URL almacenada con %s -> rechazada, nada se consulta ni escribe', async (_n, qrUrl) => {
    const e = entorno({ qrUrl });
    await expect(manejarValidarQr(e.deps, e.autorizar, 'u1', DATA)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(e.consultas).toHaveLength(0);
    expect(e.escrituras).toHaveLength(0);
  });

  it('consulta la URL RECONSTRUIDA, no el texto almacenado', async () => {
    const e = entorno({ qrUrl: `${URL_OK.replace('importe=10.50', 'importe=10.5')}&evil=1` });
    await manejarValidarQr(e.deps, e.autorizar, 'u1', DATA);
    expect(e.consultas).toEqual([URL_OK]);
  });

  it.each([
    ['validarqr-sintetica-encontrada.html', 'encontrada'],
    ['validarqr-sintetica-no-encontrada.html', 'no_encontrada'],
    ['validarqr-sintetica-no-verificable.html', 'no_verificable'],
  ])('%s -> %s y se persiste', async (nombre, estado) => {
    const e = entorno({ html: fixture(nombre) });
    const r = await manejarValidarQr(e.deps, e.autorizar, 'u1', DATA);
    expect(r.estado).toBe(estado);
    expect(e.escrituras).toEqual([expect.objectContaining({ companyId: 'co1', facturaId: 'f1', estado, urlConsulta: URL_OK })]);
  });

  it('respuesta no reconocida -> error con mensaje y enlace manual', async () => {
    const e = entorno({ html: '<main>???</main>' });
    const r = await manejarValidarQr(e.deps, e.autorizar, 'u1', DATA);
    expect(r).toMatchObject({ estado: 'error', urlConsulta: URL_OK });
    expect(e.escrituras[0]).toMatchObject({ estado: 'error', urlConsulta: URL_OK });
    expect(e.escrituras[0].mensaje).toBeTruthy();
  });

  it.each([[302], [500], [403]])('HTTP %i -> error (sin seguir redirecciones)', async (status) => {
    const e = entorno({ status, html: fixture('validarqr-sintetica-encontrada.html') });
    const r = await manejarValidarQr(e.deps, e.autorizar, 'u1', DATA);
    expect(r.estado).toBe('error');
  });

  it('fallo de red/timeout -> error persistido, sin lanzar ni filtrar el detalle', async () => {
    const e = entorno({ falla: true });
    const r = await manejarValidarQr(e.deps, e.autorizar, 'u1', DATA);
    expect(r).toMatchObject({ estado: 'error', urlConsulta: URL_OK });
    expect(r.mensaje).not.toContain('boom');
    expect(e.escrituras).toHaveLength(1);
  });

  it('captura real (NIF inválido) -> error con el texto de la AEAT', async () => {
    const e = entorno({ html: fixture('validarqr-sandbox-nif-invalido.html') });
    const r = await manejarValidarQr(e.deps, e.autorizar, 'u1', DATA);
    expect(r.estado).toBe('error');
    expect(r.mensaje).toContain('NIF');
  });
});

describe('crearConsulta (fetch acotado)', () => {
  const html = '<main><p>Factura encontrada</p></main>';

  it('usa redirect manual, timeout y devuelve status+html', async () => {
    const fake = vi.fn(async () => new Response(html, { status: 200 }));
    const r = await crearConsulta(fake as unknown as typeof fetch)(URL_OK);
    expect(r).toEqual({ status: 200, html });
    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_OK);
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.method).toBe('GET');
  });

  it('decodifica ISO-8859-15 por defecto', async () => {
    const bytes = Uint8Array.from([0x3c, 0x70, 0x3e, 0xf1, 0x3c, 0x2f, 0x70, 0x3e]); // <p>ñ</p>
    const fake = async () => new Response(bytes, { status: 200 });
    expect((await crearConsulta(fake as unknown as typeof fetch)(URL_OK)).html).toBe('<p>ñ</p>');
  });

  it('cuerpo > 1 MB -> lanza', async () => {
    const grande = new Uint8Array(MAX_BYTES + 1);
    const fake = async () => new Response(grande, { status: 200 });
    await expect(crearConsulta(fake as unknown as typeof fetch)(URL_OK)).rejects.toThrow(/tamaño|grande/i);
  });

  it('no lee el cuerpo de una redirección', async () => {
    const fake = async () => new Response('x', { status: 302, headers: { location: 'https://evil.example.com' } });
    const r = await crearConsulta(fake as unknown as typeof fetch)(URL_OK);
    expect(r).toEqual({ status: 302, html: '' });
  });
});
