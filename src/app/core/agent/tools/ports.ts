/**
 * Puertos mínimos que necesitan las tools.
 *
 * Deliberadamente estructurales: `Router` de Angular encaja en `NavegadorPort`
 * sin adaptador, y los tests pueden pasar un doble de tres líneas sin arrastrar
 * TestBed. Las tools no importan Angular — solo tipos del dominio.
 */
export interface NavegadorPort {
  navigate(
    commands: unknown[],
    extras?: { queryParams?: Record<string, string>; state?: Record<string, unknown> },
  ): Promise<boolean>;
}

/** Lee el primer string no vacío de los argumentos que mandó el modelo. */
export function leerTexto(args: Record<string, unknown>, clave: string): string | undefined {
  const valor = args[clave];
  if (typeof valor !== 'string') return undefined;
  const limpio = valor.trim();
  return limpio || undefined;
}

/**
 * Valida un argumento contra un catálogo cerrado. Si no encaja devuelve el
 * listado completo: el modelo lee el error y reintenta con un valor válido,
 * cosa que no puede hacer si solo le dices "valor inválido".
 */
export function leerOpcion<T extends string>(
  args: Record<string, unknown>,
  clave: string,
  validos: readonly T[],
): { ok: true; valor?: T } | { ok: false; error: string } {
  const valor = leerTexto(args, clave);
  if (valor === undefined) return { ok: true };
  if (!validos.includes(valor as T)) {
    return { ok: false, error: `"${valor}" no es un ${clave} válido. Usa uno de: ${validos.join(', ')}.` };
  }
  return { ok: true, valor: valor as T };
}

/** Quita las claves sin valor para no ensuciar el state de navegación. */
export function compactar<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
