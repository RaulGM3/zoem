/**
 * Constructor de esquemas de parámetros para las tools del agente.
 *
 * ¿Por qué existe esto si `firebase/ai` ya trae `Schema`?
 *
 * Porque `provideAgentTools()` se registra en `app.config.ts`, o sea en el
 * BUNDLE INICIAL. Los tres ficheros de tools importaban `Schema` como VALOR
 * (no como tipo), así que el SDK entero de Gemini viajaba a todo usuario antes
 * incluso de la pantalla de login — solo para describir los parámetros de unas
 * herramientas que la mayoría no llega a usar.
 *
 * Este módulo no tiene dependencias. Emite directamente el JSON que Gemini
 * espera, sin pasar por `toJSON()`.
 *
 * OJO con el detalle que hace esto delicado: el formato de AUTORÍA y el
 * formato de CABLE no son el mismo. Al escribir se declara qué es opcional
 * (`optionalProperties`); por el cable viaja lo contrario, qué es obligatorio
 * (`required`). Esa inversión la hacía `ObjectSchema.toJSON()` y la hacemos
 * aquí. Se mantiene el formato de autoría del SDK a propósito: así el diff en
 * los ficheros de tools es solo el import, y volver atrás es trivial.
 *
 * La paridad con el SDK NO se asume: `esquema.spec.ts` la comprueba contra
 * `firebase/ai` de verdad. Si el SDK cambia su serialización, ese test avisa.
 */

/** Parámetros comunes a cualquier esquema. Se admiten claves extra, como el SDK. */
export interface ParamsEsquema {
  description?: string;
  nullable?: boolean;
  format?: string;
  example?: unknown;
  [clave: string]: unknown;
}

/** Un esquema YA en formato de cable: es lo que se serializa tal cual. */
export interface EsquemaCable {
  type: string;
  nullable: boolean;
  description?: string;
  format?: string;
  enum?: string[];
  properties?: Record<string, EsquemaCable>;
  required?: string[];
  [clave: string]: unknown;
}

/** Esquema de objeto — el único que se usa como `parameters` de una tool. */
export interface EsquemaObjeto extends EsquemaCable {
  type: 'object';
  properties: Record<string, EsquemaCable>;
}

/**
 * Base común. Replica `Schema.toJSON()`: arranca por `type`, copia los
 * parámetros definidos y deja `nullable` siempre explícito (el SDK lo emite
 * incluso cuando vale `false`, y el objetivo es un JSON idéntico).
 */
function base(type: string, params: ParamsEsquema = {}): EsquemaCable {
  const salida: EsquemaCable = { type, nullable: false };

  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined) continue;
    // El SDK descarta `required` salvo en objetos, donde lo calcula él mismo.
    if (clave === 'required' && type !== 'object') continue;
    salida[clave] = valor;
  }

  salida.nullable = params.nullable === undefined ? false : !!params.nullable;
  return salida;
}

export const Esquema = {
  string(params?: ParamsEsquema): EsquemaCable {
    return base('string', params);
  },

  /** Cadena restringida a un conjunto cerrado de valores. */
  enumString(params: ParamsEsquema & { enum: string[] }): EsquemaCable {
    return base('string', params);
  },

  integer(params?: ParamsEsquema): EsquemaCable {
    return base('integer', params);
  },

  number(params?: ParamsEsquema): EsquemaCable {
    return base('number', params);
  },

  boolean(params?: ParamsEsquema): EsquemaCable {
    return base('boolean', params);
  },

  /**
   * Objeto. Aquí ocurre la inversión: lo que NO esté en `optionalProperties`
   * es obligatorio. Sin `optionalProperties`, TODO es obligatorio — mismo
   * criterio que el SDK, cuyo valor por defecto es `[]`.
   */
  object(params: ParamsEsquema & {
    properties: Record<string, EsquemaCable>;
    optionalProperties?: string[];
  }): EsquemaObjeto {
    const { properties, optionalProperties = [], ...resto } = params;

    for (const clave of optionalProperties) {
      if (!Object.prototype.hasOwnProperty.call(properties, clave)) {
        throw new Error(
          `La propiedad "${clave}" está en "optionalProperties" pero no existe en "properties".`,
        );
      }
    }

    const salida = base('object', resto) as EsquemaObjeto;
    salida.properties = { ...properties };

    const obligatorias = Object.keys(properties).filter((c) => !optionalProperties.includes(c));
    if (obligatorias.length > 0) salida.required = obligatorias;

    return salida;
  },
} as const;
