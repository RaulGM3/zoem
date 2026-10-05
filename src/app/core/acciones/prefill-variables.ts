export interface VariablePrefill {
  key: string;
  label?: string;
}

/**
 * Pre-rellena variables por coincidencia laxa: un token del contexto (p. ej.
 * `cliente`) rellena toda variable cuya clave o etiqueta lo contenga
 * (`nombre_cliente`, "Cliente / parte"). Gana el primer token del contexto con
 * valor no vacío. Las variables sin coincidencia no aparecen en el resultado.
 */
export function prefillVariables(
  variables: VariablePrefill[],
  contexto: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variables) {
    const haystack = `${v.key} ${v.label ?? ''}`.toLowerCase();
    for (const [token, value] of Object.entries(contexto)) {
      if (value && haystack.includes(token)) {
        out[v.key] = value;
        break;
      }
    }
  }
  return out;
}
