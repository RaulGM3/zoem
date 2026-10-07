import type { Routes } from '@angular/router';

export const CONFIGURACION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Configuración',
    loadComponent: () => import('./configuracion-index').then((m) => m.ConfiguracionIndexComponent),
  },
  {
    path: 'empresa',
    title: 'Datos de la empresa',
    data: { seccion: 'empresa' },
    loadComponent: () =>
      import('./secciones/datos-empresa/datos-empresa-seccion').then((m) => m.DatosEmpresaSeccionComponent),
  },
  {
    path: 'usuarios',
    title: 'Usuarios y permisos',
    data: { seccion: 'usuarios' },
    loadComponent: () =>
      import('./secciones/usuarios/usuarios-seccion').then((m) => m.UsuariosSeccionComponent),
  },
  {
    path: 'facturacion',
    title: 'Facturación',
    data: { seccion: 'facturacion' },
    loadComponent: () =>
      import('./secciones/facturacion/facturacion-seccion').then((m) => m.FacturacionSeccionComponent),
  },
  {
    path: 'tesoreria',
    title: 'Tesorería',
    data: { seccion: 'tesoreria' },
    loadComponent: () =>
      import('./secciones/tesoreria/tesoreria-seccion').then((m) => m.TesoreriaSeccionComponent),
  },
  {
    path: 'dias-inhabiles',
    title: 'Días inhábiles',
    data: { seccion: 'dias-inhabiles' },
    loadComponent: () =>
      import('../dias-inhabiles/dias-inhabiles-seccion').then((m) => m.DiasInhabilesSeccionComponent),
  },
  { path: '**', redirectTo: '' },
];
