export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TIPOS = ['image/png', 'image/jpeg'] as const;

export type ResultadoValidacionLogo = { ok: true } | { ok: false; error: string };

/** Valida tipo (PNG/JPG) y tamaño (<= 1 MB) antes de tocar Storage. */
export function validarLogo(file: { type: string; size: number }): ResultadoValidacionLogo {
  if (!(LOGO_TIPOS as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Formato no admitido (PNG o JPG)' };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: 'Máximo 1 MB' };
  }
  return { ok: true };
}

/** Encaja un logo (px) dentro de maxW x maxH (mm) preservando la proporción. */
export function encajarLogo(
  wPx: number,
  hPx: number,
  maxW = 40,
  maxH = 16,
): { w: number; h: number } | null {
  if (!Number.isFinite(wPx) || !Number.isFinite(hPx) || wPx <= 0 || hPx <= 0) return null;
  const escala = Math.min(maxW / wPx, maxH / hPx);
  return { w: wPx * escala, h: hPx * escala };
}
