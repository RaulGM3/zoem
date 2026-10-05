// Consulta HTTP acotada a ValidarQR: GET sin seguir redirecciones, timeout y tope de tamaño.
// La URL ya viene reconstruida y validada por `parseQrVerifactu`; aquí no se vuelve a confiar en nada externo.

export const TIMEOUT_MS = 10_000;
export const MAX_BYTES = 1024 * 1024;

export interface RespuestaConsulta {
  status: number;
  html: string;
}

export type Consultar = (url: string) => Promise<RespuestaConsulta>;

function charsetDe(contentType: string | null): string {
  const m = /charset=["']?([\w-]+)/i.exec(contentType ?? '');
  return m ? m[1] : 'iso-8859-15';
}

async function leerAcotado(res: Response): Promise<Uint8Array> {
  const declarado = Number(res.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > MAX_BYTES) throw new Error('Respuesta demasiado grande');
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error('Respuesta demasiado grande');
    }
    trozos.push(value);
  }
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) {
    salida.set(t, pos);
    pos += t.byteLength;
  }
  return salida;
}

export function crearConsulta(fetchImpl: typeof fetch = fetch): Consultar {
  return async (url) => {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'text/html' },
    });
    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel();
      return { status: res.status, html: '' };
    }
    const bytes = await leerAcotado(res);
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(charsetDe(res.headers.get('content-type')));
    } catch {
      decoder = new TextDecoder('iso-8859-15');
    }
    return { status: res.status, html: decoder.decode(bytes) };
  };
}
