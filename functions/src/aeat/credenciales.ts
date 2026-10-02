// Clasificación pura de los fallos al leer las credenciales AEAT (Secret Manager + PKCS#12).
// Sin I/O: el mensaje que ve el usuario depende del motivo real, no de un genérico.

export type MotivoCredenciales = 'sin_certificado' | 'sin_permiso' | 'certificado_invalido' | 'desconocido';

/** Mensaje genérico (motivo desconocido). */
export const MENSAJE_SIN_CERTIFICADO = 'Certificado AEAT no configurado para esta empresa.';

const MENSAJES: Record<MotivoCredenciales, string> = {
  sin_certificado: 'No hay ningún certificado AEAT guardado para esta empresa. Súbelo en Facturación → Configuración.',
  sin_permiso:
    'El servidor no tiene permiso para leer el certificado AEAT. Es un problema de configuración del sistema, no de tu certificado: avisa al administrador.',
  certificado_invalido:
    'El certificado AEAT guardado no se puede abrir (contraseña incorrecta o archivo dañado). Vuelve a subirlo.',
  desconocido: MENSAJE_SIN_CERTIFICADO,
};

export function mensajeCredenciales(motivo: MotivoCredenciales): string {
  return MENSAJES[motivo];
}

/** Error propio con motivo ya decidido (lo lanzan los adaptadores al fallar el PKCS#12 o un secret vacío). */
export class ErrorCredenciales extends Error {
  constructor(
    readonly motivo: MotivoCredenciales,
    message: string,
  ) {
    super(message);
    this.name = 'ErrorCredenciales';
  }
}

const GRPC_NOT_FOUND = 5;
const GRPC_PERMISSION_DENIED = 7;

export function clasificarErrorCredenciales(err: unknown): MotivoCredenciales {
  if (err instanceof ErrorCredenciales) return err.motivo;
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (code === GRPC_NOT_FOUND) return 'sin_certificado';
  if (code === GRPC_PERMISSION_DENIED) return 'sin_permiso';
  return 'desconocido';
}
