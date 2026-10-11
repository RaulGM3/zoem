import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_MAPS_API_KEY, PLACES_LOADER, PlacesService, type BibliotecaPlaces } from './places.service';

describe('PlacesService', () => {
  const fetchAutocompleteSuggestions = vi.fn();
  const fetchFields = vi.fn();
  const toPlace = vi.fn();
  const SessionToken = vi.fn();
  const cargar = vi.fn();

  const prediccion = (placeId: string, principal: string, secundario: string) => ({
    placePrediction: {
      placeId,
      text: { text: `${principal}, ${secundario}` },
      mainText: { text: principal },
      secondaryText: { text: secundario },
      toPlace,
    },
  });

  function configurar(clave: string | null = 'KEY') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GOOGLE_MAPS_API_KEY, useValue: clave },
        { provide: PLACES_LOADER, useValue: cargar },
      ],
    });
    return TestBed.inject(PlacesService);
  }

  beforeEach(() => {
    [fetchAutocompleteSuggestions, fetchFields, toPlace, SessionToken, cargar].forEach((f) => f.mockReset());
    const lib: BibliotecaPlaces = {
      AutocompleteSessionToken: SessionToken as unknown as BibliotecaPlaces['AutocompleteSessionToken'],
      AutocompleteSuggestion: { fetchAutocompleteSuggestions },
    };
    cargar.mockResolvedValue(lib);
    SessionToken.mockImplementation(function (this: { id: number }) {
      this.id = SessionToken.mock.calls.length;
    });
    fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [prediccion('p1', 'Medellín', 'Antioquia, Colombia'), { placePrediction: null }],
    });
    toPlace.mockReturnValue({
      fetchFields,
      displayName: 'Medellín',
      location: { lat: () => 6.2442, lng: () => -75.5812 },
      addressComponents: [
        { longText: 'Medellín', shortText: 'Medellín', types: ['locality', 'political'] },
        { longText: 'Antioquia', shortText: 'Antioquia', types: ['administrative_area_level_1', 'political'] },
        { longText: 'Colombia', shortText: 'CO', types: ['country', 'political'] },
      ],
    });
    fetchFields.mockResolvedValue({});
  });

  it('sin API key no está disponible y no intenta cargar nada', async () => {
    const svc = configurar('');
    expect(svc.disponible()).toBe(false);
    await expect(svc.buscar('Med', 'CO')).rejects.toThrow();
    expect(cargar).not.toHaveBeenCalled();
  });

  it('busca ciudades limitadas al país, con tipo (cities) y token de sesión', async () => {
    const svc = configurar();
    const r = await svc.buscar('Medel', 'CO');

    expect(cargar).toHaveBeenCalledWith('KEY');
    const req = fetchAutocompleteSuggestions.mock.calls[0][0];
    expect(req).toMatchObject({ input: 'Medel', includedRegionCodes: ['co'], includedPrimaryTypes: ['(cities)'], language: 'es' });
    expect(req.sessionToken).toBeInstanceOf(SessionToken);
    expect(r).toEqual([{ placeId: 'p1', principal: 'Medellín', secundario: 'Antioquia, Colombia', texto: 'Medellín, Antioquia, Colombia' }]);
  });

  it('reutiliza el token de sesión entre pulsaciones y lo renueva tras elegir una ciudad', async () => {
    const svc = configurar();
    await svc.buscar('Me', 'CO');
    await svc.buscar('Med', 'CO');
    const [a, b] = fetchAutocompleteSuggestions.mock.calls.map((c) => c[0].sessionToken);
    expect(a).toBe(b);

    await svc.elegir('p1');
    await svc.buscar('Bog', 'CO');
    expect(fetchAutocompleteSuggestions.mock.calls[2][0].sessionToken).not.toBe(a);
  });

  it('elegir devuelve nombre, coordenadas y la región administrativa que informa Google', async () => {
    const svc = configurar();
    await svc.buscar('Medel', 'CO');
    const c = await svc.elegir('p1');
    expect(fetchFields).toHaveBeenCalledWith({ fields: ['addressComponents', 'location', 'displayName'] });
    expect(c).toEqual({ placeId: 'p1', nombre: 'Medellín', lat: 6.2442, lng: -75.5812, regionNombre: 'Antioquia' });
  });

  it('elegir sin una búsqueda previa de ese placeId falla', async () => {
    const svc = configurar();
    await expect(svc.elegir('desconocido')).rejects.toThrow();
  });

  it('si el loader falla (bloqueador, red) deja de estar disponible y propaga el error', async () => {
    cargar.mockRejectedValue(new Error('blocked'));
    const svc = configurar();
    expect(svc.disponible()).toBe(true);
    await expect(svc.buscar('Med', 'CO')).rejects.toThrow('blocked');
    expect(svc.disponible()).toBe(false);
  });

  it('si Places responde con error también se marca como no disponible', async () => {
    fetchAutocompleteSuggestions.mockRejectedValue(new Error('REQUEST_DENIED'));
    const svc = configurar();
    await expect(svc.buscar('Med', 'CO')).rejects.toThrow('REQUEST_DENIED');
    expect(svc.disponible()).toBe(false);
  });

  it('coordenadas ausentes: no inventa un punto', async () => {
    toPlace.mockReturnValue({ fetchFields, displayName: 'X', location: null, addressComponents: [] });
    const svc = configurar();
    await svc.buscar('X', 'CO');
    expect(await svc.elegir('p1')).toEqual({ placeId: 'p1', nombre: 'X' });
  });
});
