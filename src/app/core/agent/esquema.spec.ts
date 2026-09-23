import { describe, expect, it } from 'vitest';
import { Schema } from 'firebase/ai';
import { Esquema } from './esquema';

/**
 * Test dorado (golden test) del constructor de esquemas propio.
 *
 * `Esquema` existe para sacar `firebase/ai` del bundle inicial: las tools del
 * agente se registran en `app.config.ts` y arrastraban el SDK entero solo para
 * describir sus parámetros. Ver `esquema.ts`.
 *
 * El riesgo de esa sustitución es UNO y es serio: que el JSON que viaja a
 * Gemini deje de ser idéntico. `ObjectSchema.toJSON()` del SDK no es un volcado
 * de datos — invierte `optionalProperties` en un array `required`. Si nuestro
 * formato se desviara, el modelo pasaría a tratar como opcional un argumento
 * que antes era obligatorio, y las tools empezarían a recibir `undefined` sin
 * que nada falle a gritos.
 *
 * Por eso aquí NO se comprueba contra literales escritos a mano: se compara
 * contra lo que produce el SDK de verdad. Los specs no se empaquetan, así que
 * importar `firebase/ai` en este archivo no pesa nada en producción.
 *
 * Si el SDK cambia su formato de serialización, este test se pone rojo. Es
 * exactamente lo que se quiere.
 */

/** Lo que el SDK manda por el cable: `JSON.stringify` dispara `toJSON()`. */
const cable = (valor: unknown): unknown => JSON.parse(JSON.stringify(valor));

describe('Esquema — paridad de formato con firebase/ai', () => {
  describe('string', () => {
    it('sin parámetros', () => {
      expect(cable(Esquema.string())).toEqual(cable(Schema.string()));
    });

    it('con descripción', () => {
      const d = { description: 'Nombre o razón social a buscar.' };
      expect(cable(Esquema.string(d))).toEqual(cable(Schema.string(d)));
    });
  });

  describe('enumString', () => {
    it('emite el array enum', () => {
      const e = { enum: ['abierto', 'cerrado', 'archivado'] };
      expect(cable(Esquema.enumString(e))).toEqual(cable(Schema.enumString(e)));
    });

    it('admite descripción junto al enum', () => {
      const e = { enum: ['alta', 'media', 'baja'], description: 'Prioridad del caso.' };
      expect(cable(Esquema.enumString(e))).toEqual(cable(Schema.enumString(e)));
    });
  });

  describe('object', () => {
    it('sin optionalProperties: TODA propiedad es obligatoria', () => {
      const nuestro = Esquema.object({ properties: { contactoId: Esquema.string() } });
      const suyo = Schema.object({ properties: { contactoId: Schema.string() } });

      expect(cable(nuestro)).toEqual(cable(suyo));
      // Aserción explícita del detalle que motiva todo este archivo.
      expect((cable(nuestro) as { required: string[] }).required).toEqual(['contactoId']);
    });

    it('invierte optionalProperties en required', () => {
      const nuestro = Esquema.object({
        properties: {
          nombre: Esquema.string({ description: 'Nombre de pila. Obligatorio.' }),
          apellidos: Esquema.string(),
          mobile: Esquema.string({ description: 'Teléfono móvil.' }),
        },
        optionalProperties: ['apellidos', 'mobile'],
      });
      const suyo = Schema.object({
        properties: {
          nombre: Schema.string({ description: 'Nombre de pila. Obligatorio.' }),
          apellidos: Schema.string(),
          mobile: Schema.string({ description: 'Teléfono móvil.' }),
        },
        optionalProperties: ['apellidos', 'mobile'],
      });

      expect(cable(nuestro)).toEqual(cable(suyo));
      expect((cable(nuestro) as { required: string[] }).required).toEqual(['nombre']);
    });

    it('omite required cuando TODAS las propiedades son opcionales', () => {
      const nuestro = Esquema.object({
        properties: { consulta: Esquema.string({ description: 'Nombre o razón social a buscar.' }) },
        optionalProperties: ['consulta'],
      });
      const suyo = Schema.object({
        properties: { consulta: Schema.string({ description: 'Nombre o razón social a buscar.' }) },
        optionalProperties: ['consulta'],
      });

      expect(cable(nuestro)).toEqual(cable(suyo));
      expect(cable(nuestro)).not.toHaveProperty('required');
    });

    it('nunca deja escapar optionalProperties al cable', () => {
      const nuestro = cable(
        Esquema.object({
          properties: { a: Esquema.string(), b: Esquema.string() },
          optionalProperties: ['b'],
        }),
      );

      expect(nuestro).not.toHaveProperty('optionalProperties');
    });

    it('mezcla enumString y string anidados', () => {
      const nuestro = Esquema.object({
        properties: {
          consulta: Esquema.string({ description: 'Texto a buscar en el título del caso.' }),
          estado: Esquema.enumString({ enum: ['abierto', 'cerrado'] }),
        },
        optionalProperties: ['consulta', 'estado'],
      });
      const suyo = Schema.object({
        properties: {
          consulta: Schema.string({ description: 'Texto a buscar en el título del caso.' }),
          estado: Schema.enumString({ enum: ['abierto', 'cerrado'] }),
        },
        optionalProperties: ['consulta', 'estado'],
      });

      expect(cable(nuestro)).toEqual(cable(suyo));
    });
  });

  describe('validación', () => {
    it('rechaza un optionalProperties que no existe, igual que el SDK', () => {
      const construir = () =>
        cable(
          Esquema.object({
            properties: { nombre: Esquema.string() },
            optionalProperties: ['inexistente'],
          }),
        );

      expect(construir).toThrow(/inexistente/);
      // El SDK falla en toJSON(); nosotros al construir. Lo que importa es que
      // ninguno de los dos deje pasar el error en silencio.
      expect(() =>
        cable(
          Schema.object({
            properties: { nombre: Schema.string() },
            optionalProperties: ['inexistente'],
          }),
        ),
      ).toThrow();
    });
  });
});
