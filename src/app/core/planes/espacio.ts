const MB = 1_048_576;

export type ResultadoEspacio = { cabe: true } | { cabe: false; quedanMB: number };

/** ¿Cabe `bytes` más en el almacenamiento? `limiteMB` Infinity = ilimitado. Lógica pura. */
export function evaluarEspacio(p: { usadoBytes: number; limiteMB: number; bytes: number }): ResultadoEspacio {
  if (!Number.isFinite(p.limiteMB)) return { cabe: true };
  const limiteBytes = p.limiteMB * MB;
  if (p.usadoBytes + p.bytes <= limiteBytes) return { cabe: true };
  return { cabe: false, quedanMB: Math.max(0, Math.floor((limiteBytes - p.usadoBytes) / MB)) };
}

/** Tamaño de un archivo para el usuario: <10 MB con un decimal (coma) hacia arriba; si no, MB enteros hacia arriba. */
function formatearMB(bytes: number): string {
  const mb = bytes / MB;
  if (mb >= 10) return `${Math.ceil(mb)} MB`;
  return `${(Math.ceil(mb * 10) / 10).toString().replace('.', ',')} MB`;
}

export function mensajeSinEspacio(quedanMB: number, archivoBytes: number): string {
  const quedan = quedanMB < 1 ? 'menos de 1 MB' : `${quedanMB} MB`;
  return `No queda espacio: te quedan ${quedan} y el archivo ocupa ${formatearMB(archivoBytes)}.`;
}
