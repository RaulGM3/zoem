import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { superUserGuard } from './auth/superuser.guard';
import { permissionGuard } from './auth/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/demo-layout/demo-layout').then(
        (m) => m.DemoLayoutComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'proyectos',
        loadComponent: () =>
          import('./components/proyectos/proyectos').then((m) => m.ProyectosComponent),
      },
      {
        path: 'proyectos/:id',
        loadComponent: () =>
          import('./components/proyecto-detail/proyecto-detail').then((m) => m.ProyectoDetailComponent),
      },
      {
        path: 'contactos',
        canActivate: [permissionGuard('Contactos')],
        loadComponent: () =>
          import('./components/contactos/contactos').then((m) => m.ContactosComponent),
      },
      {
        path: 'contactos/:id',
        canActivate: [permissionGuard('Contactos')],
        loadComponent: () =>
          import('./components/contacto-detail/contacto-detail').then((m) => m.ContactoDetailComponent),
      },
      {
        path: 'recepcion-ia',
        canActivate: [permissionGuard('RecepciónIA')],
        loadComponent: () =>
          import('./components/recepcion-ia/recepcion-ia').then(
            (m) => m.RecepcionIAComponent
          ),
      },
      {
        path: 'facturacion',
        canActivate: [permissionGuard('Facturación')],
        loadComponent: () =>
          import('./components/facturacion/facturacion').then(
            (m) => m.FacturacionComponent
          ),
      },
      {
        path: 'calendario',
        canActivate: [permissionGuard('Calendario')],
        loadComponent: () =>
          import('./components/calendario/calendario').then(
            (m) => m.CalendarioComponent
          ),
      },
      {
        path: 'eventos',
        loadComponent: () =>
          import('./components/eventos/eventos').then((m) => m.EventosComponent),
      },
      {
        path: 'documentos',
        canActivate: [permissionGuard('Documentos')],
        loadComponent: () =>
          import('./components/documentos/documentos').then(
            (m) => m.DocumentosComponent
          ),
      },
      {
        path: 'documentos/:id',
        canActivate: [permissionGuard('Documentos')],
        loadComponent: () =>
          import('./components/doc-template-detail/doc-template-detail').then(
            (m) => m.DocTemplateDetailComponent
          ),
      },
      {
        path: 'tesoreria',
        canActivate: [permissionGuard('Tesorería')],
        loadComponent: () =>
          import('./components/tesoreria/tesoreria').then((m) => m.TesoreriaComponent),
      },
      {
        path: 'comunicaciones',
        loadComponent: () =>
          import('./components/comunicaciones/comunicaciones').then((m) => m.ComunicacionesComponent),
      },
      {
        path: 'informes',
        loadComponent: () =>
          import('./components/informes/informes').then((m) => m.InformesComponent),
      },
      {
        path: 'agente-ia',
        loadComponent: () =>
          import('./components/agente-ia/agente-ia').then((m) => m.AgenteIAComponent),
      },
      {
        path: 'vertey-studio',
        loadComponent: () =>
          import('./components/vertey-studio/vertey-studio').then((m) => m.VerteyStudioComponent),
      },
      {
        path: 'usuarios',
        canActivate: [permissionGuard('Configuración')],
        loadComponent: () =>
          import('./components/usuarios/usuarios').then((m) => m.UsuariosComponent),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./components/perfil/perfil').then((m) => m.PerfilComponent),
      },
      {
        path: 'casos',
        canActivate: [permissionGuard('Casos')],
        loadComponent: () =>
          import('./components/casos/casos').then((m) => m.CasosComponent),
      },
      {
        path: 'casos/:id',
        canActivate: [permissionGuard('Casos')],
        loadComponent: () =>
          import('./components/caso-detail/caso-detail').then((m) => m.CasoDetailComponent),
      },
      {
        path: 'plantillas',
        canActivate: [permissionGuard('Configuración')],
        loadComponent: () =>
          import('./components/plantillas/plantillas').then((m) => m.PlantillasComponent),
      },
      {
        path: 'plantillas/:id',
        canActivate: [permissionGuard('Configuración')],
        loadComponent: () =>
          import('./components/plantilla-detail/plantilla-detail').then((m) => m.PlantillaDetailComponent),
      },
      {
        path: 'llamadas',
        loadComponent: () =>
          import('./components/llamadas/llamadas.component').then((m) => m.LlamadasComponent),
      },
    ],
  },
  {
    path: 'superuser',
    canActivate: [superUserGuard],
    loadComponent: () =>
      import('./components/superuser/superuser-layout/superuser-layout').then(
        (m) => m.SuperuserLayoutComponent
      ),
    children: [
      { path: '', redirectTo: 'companies', pathMatch: 'full' },
      {
        path: 'companies',
        loadComponent: () =>
          import('./components/superuser/companies/companies').then(
            (m) => m.CompaniesComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./components/superuser/users/users').then((m) => m.UsersComponent),
      },
      {
        path: 'agents',
        loadComponent: () =>
          import('./components/superuser/agents/agents').then((m) => m.AgentsComponent),
      },
      {
        path: 'errors',
        loadComponent: () =>
          import('./components/superuser/errors/errors').then((m) => m.ErrorsComponent),
      },
    ],
  },
  {
    path: 'invite/:token',
    loadComponent: () =>
      import('./components/invite/invite').then((m) => m.InviteComponent),
  },
  { path: '**', redirectTo: '' },
];
