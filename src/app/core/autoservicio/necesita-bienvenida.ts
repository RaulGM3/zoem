/** ¿Debe ver el asistente de alta? Solo quien no pertenece a ningún despacho (y no es superusuario). */
export function necesitaBienvenida(e: { esSuperuser: boolean; membresias: number; empresaActiva: boolean }): boolean {
  return !e.esSuperuser && e.membresias === 0 && !e.empresaActiva;
}
