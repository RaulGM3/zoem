/**
 * Traducción centralizada de errores de Firebase/Firestore a mensajes humanos
 * en español. UN solo lugar para decidir qué se le muestra al usuario y si la
 * operación tiene sentido reintentarse.
 *
 * Lógica PURA (sin dependencias de Angular) para poder testearla aislada.
 */

export interface FirebaseErrorInfo {
  /** Código normalizado (sin prefijo de servicio). Ej: 'permission-denied'. */
  readonly code: string;
  /** Mensaje listo para mostrar al usuario, en español. */
  readonly message: string;
  /** Si vale la pena ofrecer "Reintentar" como acción que pueda resolverlo. */
  readonly retriable: boolean;
  /** Detalle técnico para logs/console (no se muestra al usuario por defecto). */
  readonly technicalDetail: string;
}

interface CodeSpec {
  readonly message: string;
  readonly retriable: boolean;
}

/** Mapa de códigos Firestore (gRPC) → mensaje + si es reintentable. */
const CODE_MAP: Record<string, CodeSpec> = {
  'permission-denied': {
    message: 'No tienes permisos para realizar esta acción. Si crees que es un error, contacta con un administrador.',
    retriable: false,
  },
  unauthenticated: {
    message: 'Tu sesión ha expirado. Vuelve a iniciar sesión para continuar.',
    retriable: false,
  },
  'invalid-argument': {
    message: 'Los datos enviados no son válidos. Revisa el formulario e inténtalo de nuevo.',
    retriable: false,
  },
  'failed-precondition': {
    message: 'No se puede completar la operación en el estado actual. Recarga la página e inténtalo de nuevo.',
    retriable: true,
  },
  'not-found': {
    message: 'El elemento que intentas usar ya no existe. Es posible que haya sido eliminado.',
    retriable: false,
  },
  'already-exists': {
    message: 'Ya existe un elemento con estos datos.',
    retriable: false,
  },
  unavailable: {
    message: 'Problema de conexión con el servidor. Comprueba tu conexión a internet e inténtalo de nuevo.',
    retriable: true,
  },
  'deadline-exceeded': {
    message: 'La operación tardó demasiado por la conexión. Inténtalo de nuevo.',
    retriable: true,
  },
  aborted: {
    message: 'La operación se interrumpió por un conflicto. Inténtalo de nuevo.',
    retriable: true,
  },
  cancelled: {
    message: 'La operación fue cancelada. Inténtalo de nuevo.',
    retriable: true,
  },
  internal: {
    message: 'Error interno del servidor. Inténtalo de nuevo en unos instantes.',
    retriable: true,
  },
  'resource-exhausted': {
    message: 'Se alcanzó el límite de uso. Espera unos instantes e inténtalo de nuevo.',
    retriable: true,
  },
  unimplemented: {
    message: 'Esta operación no está disponible en este momento.',
    retriable: false,
  },
  'data-loss': {
    message: 'Error grave de datos. Inténtalo de nuevo y, si persiste, contacta con soporte.',
    retriable: true,
  },
};

const GENERIC: CodeSpec = {
  message: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  retriable: true,
};

/** Quita el prefijo de servicio: 'firestore/permission-denied' → 'permission-denied'. */
function normalizeCode(code: string): string {
  const slash = code.lastIndexOf('/');
  return slash >= 0 ? code.slice(slash + 1) : code;
}

function extractCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err) {
    const raw = (err as { code: unknown }).code;
    if (typeof raw === 'string' && raw.length > 0) return normalizeCode(raw);
  }
  return null;
}

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

export function translateFirebaseError(err: unknown): FirebaseErrorInfo {
  const rawMessage = extractMessage(err);
  let code = extractCode(err);

  // El clásico "Function addDoc() called with invalid data. Unsupported field
  // value: undefined" NO siempre llega con code → lo detectamos por el mensaje.
  if (!code && /invalid data|unsupported field value|called with invalid/i.test(rawMessage)) {
    code = 'invalid-argument';
  }

  const spec = (code && CODE_MAP[code]) || GENERIC;

  return {
    code: code ?? 'unknown',
    message: spec.message,
    retriable: spec.retriable,
    technicalDetail: `[${code ?? 'unknown'}] ${rawMessage}`.trim(),
  };
}
