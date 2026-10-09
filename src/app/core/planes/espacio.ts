const MB = 1_048_576;

export type ResultadoEspacio = { cabe: true } | { cabe: false; quedanMB: number };

/** ¿Cabe `bytes` más en el almacenamiento? `limiteMB` Infinity = ilimitado. Lógica pura. */
export function evaluarEspacio(p: { usadoBytes: number; limiteMB: number; bytes: number }): ResultadoEspacio {
  if (!Number.isFinite(p.limiteMB)) return { cabe: true };
  const limiteBytes = p.limiteMB * MB;
  if (p.usadoBytes + p.bytes <= limiteBytes) return { cabe: true };
  return { cabe: false, quedanMB: Math.max(0, Math.floor((limiteBytes - p.usadoBytes) / MB)) };
}

export function mensajeSinEspacio(quedanMB: number): string {
  return quedanMB < 1
    ? 'No queda espacio: te quedan menos de 1 MB.'
    : `No queda espacio: te quedan ${quedanMB} MB.`;
}
