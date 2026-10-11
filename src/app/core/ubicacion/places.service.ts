import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import type { CodigoPais } from '../paises/catalogo-paises';
import { environment } from '../../../environments/environment';

/**
 * Subconjunto de Places API (New) que usamos. Se declara aquí (en vez de usar `google.maps.*`)
 * para no depender de tipos globales y poder simular la biblioteca en los tests.
 */
interface TextoPlaces {
  text: string;
}

export interface PrediccionPlaces {
  placeId: string;
  text: TextoPlaces;
  mainText?: TextoPlaces | null;
  secondaryText?: TextoPlaces | null;
  toPlace(): LugarPlaces;
}

export interface LugarPlaces {
  fetchFields(opciones: { fields: string[] }): Promise<unknown>;
  displayName?: string | null;
  location?: { lat(): number; lng(): number } | null;
  addressComponents?: { longText?: string | null; shortText?: string | null; types: string[] }[] | null;
}

export interface BibliotecaPlaces {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(peticion: {
      input: string;
      includedRegionCodes: string[];
      includedPrimaryTypes: string[];
      language: string;
      sessionToken: object;
    }): Promise<{ suggestions: { placePrediction: PrediccionPlaces | null }[] }>;
  };
}

export interface SugerenciaCiudad {
  placeId: string;
  /** Texto completo (principal + secundario). */
  texto: string;
  principal: string;
  secundario: string;
}

export interface CiudadElegida {
  placeId: string;
  nombre: string;
  lat?: number;
  lng?: number;
  /** `administrative_area_level_1` según Google; el llamador lo traduce con `regionDesdeNombre`. */
  regionNombre?: string;
}

/** Clave de Maps JS limitada por referrer HTTP y solo a Places API (New). Vacía => Places desactivado. */
export const GOOGLE_MAPS_API_KEY = new InjectionToken<string | null>('GOOGLE_MAPS_API_KEY', {
  providedIn: 'root',
  // `googleMapsApiKey` puede faltar en environments antiguos (están fuera de git): no debe romper el build.
  factory: () => (environment as unknown as { googleMapsApiKey?: string }).googleMapsApiKey ?? null,
});

export type CargadorPlaces = (clave: string) => Promise<BibliotecaPlaces>;

export const PLACES_LOADER = new InjectionToken<CargadorPlaces>('PLACES_LOADER', {
  providedIn: 'root',
  factory: () => async (clave) => {
    setOptions({ key: clave, v: 'weekly' });
    return (await importLibrary('places')) as unknown as BibliotecaPlaces;
  },
});

/**
 * Autocompletado de ciudades con Google Places (New). Es un extra: si no hay clave, el bloqueador de anuncios
 * corta la carga o Google responde con error, `disponible` pasa a false y la UI usa texto libre.
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly clave = inject(GOOGLE_MAPS_API_KEY);
  private readonly cargador = inject(PLACES_LOADER);

  private readonly fallo = signal(false);
  readonly disponible = computed(() => !!this.clave && !this.fallo());

  private biblioteca: Promise<BibliotecaPlaces> | null = null;
  /** Se factura por sesión: un token por tanda de búsquedas, hasta que se elige una ciudad. */
  private token: object | null = null;
  private readonly predicciones = new Map<string, PrediccionPlaces>();

  async buscar(texto: string, pais: CodigoPais): Promise<SugerenciaCiudad[]> {
    const lib = await this.cargar();
    this.token ??= new lib.AutocompleteSessionToken();
    try {
      const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: texto,
        // CLDR en minúsculas ('co'), como en la documentación de Places (New).
        includedRegionCodes: [pais.toLowerCase()],
        includedPrimaryTypes: ['(cities)'],
        language: 'es',
        sessionToken: this.token,
      });
      this.predicciones.clear();
      const salida: SugerenciaCiudad[] = [];
      for (const s of suggestions) {
        const p = s.placePrediction;
        if (!p) continue;
        this.predicciones.set(p.placeId, p);
        salida.push({
          placeId: p.placeId,
          texto: p.text.text,
          principal: p.mainText?.text ?? p.text.text,
          secundario: p.secondaryText?.text ?? '',
        });
      }
      return salida;
    } catch (e) {
      this.fallo.set(true);
      throw e;
    }
  }

  /** Resuelve la ciudad elegida y cierra la sesión de facturación. */
  async elegir(placeId: string): Promise<CiudadElegida> {
    const prediccion = this.predicciones.get(placeId);
    if (!prediccion) throw new Error('Ciudad no encontrada entre las sugerencias');
    try {
      const lugar = prediccion.toPlace();
      await lugar.fetchFields({ fields: ['addressComponents', 'location', 'displayName'] });
      const regionNombre = lugar.addressComponents?.find((c) => c.types.includes('administrative_area_level_1'))?.longText;
      return {
        placeId,
        nombre: lugar.displayName ?? prediccion.mainText?.text ?? prediccion.text.text,
        ...(lugar.location ? { lat: lugar.location.lat(), lng: lugar.location.lng() } : {}),
        ...(regionNombre ? { regionNombre } : {}),
      };
    } catch (e) {
      this.fallo.set(true);
      throw e;
    } finally {
      this.token = null;
      this.predicciones.clear();
    }
  }

  private cargar(): Promise<BibliotecaPlaces> {
    if (!this.clave) return Promise.reject(new Error('Google Places no está configurado'));
    this.biblioteca ??= this.cargador(this.clave).catch((e) => {
      this.fallo.set(true);
      this.biblioteca = null;
      throw e;
    });
    return this.biblioteca;
  }
}
