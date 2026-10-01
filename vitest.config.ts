import { defineConfig } from 'vitest/config';

// Configuración base que el builder `@angular/build:unit-test` mezcla con la suya.
// El builder arranca Vitest con `isolate: false`: los módulos se comparten entre
// ficheros del mismo worker y un `vi.mock` llega tarde si otro spec ya cargó el
// módulo real (p. ej. invoice.service.spec falla con NG0201 según el orden).
export default defineConfig({
  test: {
    isolate: true,
  },
});
