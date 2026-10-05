/**
 * Contexto vivo para el system prompt. Saber en qué pantalla está el usuario
 * es lo que permite que "créame un caso aquí" o "ábreme este" tengan sentido.
 *
 * Es una función aparte porque hay dos entradas al agente (el chat y la hoja
 * de voz del móvil) y las dos tienen que contarle lo mismo al modelo.
 */
export function contextoAgente(url: string, rol: string | null): string {
  return `- Pantalla actual: ${url}\n- Rol del usuario: ${rol ?? 'sin rol asignado'}`;
}
