import type { Guia } from '../guia';

export const GUIA_CONFIGURACION: Guia = {
  id: 'configuracion',
  titulo: 'Usuarios y Permisos',
  modulo: 'Configuración',
  ruta: '/configuracion',
  resumen: 'El área de Configuración del despacho (datos de la empresa, facturación y tesorería) y, dentro, la gestión de accesos del equipo: quién entra al despacho, con qué rol y qué puede hacer en cada módulo.',
  paraQue:
    'Poner en marcha el despacho: invitar al equipo, decidir qué ve y qué puede hacer cada rol, y atender las solicitudes de permiso.',
  claves: ['configuración', 'datos de la empresa', 'logo', 'equipo', 'miembros', 'roles', 'accesos', 'administración', 'personal', 'configurar despacho'],
  tareas: [
    {
      id: 'invitar-usuario',
      titulo: 'Invitar a un usuario al despacho',
      claves: ['añadir miembro', 'alta', 'nuevo usuario', 'invitación', 'enlace', 'empleado', 'dar acceso'],
      requiere: { modulo: 'Configuración', capacidad: 'crear' },
      pasos: [
        'En "Configuración", abre "Usuarios y permisos" y pulsa "Invitar usuario".',
        'Escribe el "Correo electrónico" y elige el "Rol".',
        'Pulsa "Generar invitación".',
        'Pulsa "Copiar enlace" y envíaselo a la persona por el medio que prefieras.',
      ],
      nota: 'Vertey no envía el correo: el enlace lo compartes tú. La persona tiene 7 días para aceptarlo antes de que expire.',
    },
    {
      id: 'invitaciones-pendientes',
      titulo: 'Recuperar el enlace de una invitación pendiente',
      claves: ['reenviar', 'copiar enlace', 'expira', 'pendientes'],
      pasos: [
        'En la pestaña "Usuarios", baja hasta "Invitaciones pendientes".',
        'Pulsa "Copiar enlace" en la invitación y vuelve a compartirlo.',
      ],
    },
    {
      id: 'editar-usuario',
      titulo: 'Cambiar el rol o los datos de un usuario',
      claves: ['modificar', 'rol', 'departamento', 'tarifa por hora', 'estado', 'desactivar'],
      requiere: { modulo: 'Configuración', capacidad: 'editar' },
      pasos: [
        'En la pestaña "Usuarios", pulsa el usuario en la tabla.',
        'Cambia "Nombre", "Apellido", "Teléfono", "Departamento", "Rol", "Estado" o "Tarifa por hora (€)".',
        'Pulsa "Guardar cambios".',
      ],
    },
    {
      id: 'permisos-individuales',
      titulo: 'Dar o quitar un permiso a una sola persona',
      claves: ['excepción', 'override', 'permiso individual', 'caso particular'],
      requiere: { modulo: 'Configuración', capacidad: 'editar' },
      pasos: [
        'En la pestaña "Usuarios", pulsa el usuario en la tabla.',
        'Baja hasta "Permisos individuales".',
        'Toca una celda para alternar entre heredar del rol, permitir o denegar.',
        'Pulsa "Guardar cambios".',
      ],
      nota: 'Son excepciones sobre su rol: afectan solo a esa persona. Con "Quitar todas" vuelve a heredar todo de su rol.',
    },
    {
      id: 'permisos-por-rol',
      titulo: 'Cambiar lo que puede hacer cada rol',
      claves: ['matriz', 'capacidades', 'ver', 'crear', 'editar', 'eliminar', 'módulos', 'gestor', 'viewer'],
      requiere: { modulo: 'Configuración', capacidad: 'editar' },
      pasos: [
        'Ve a la pestaña "Permisos".',
        'Cada fila es un módulo y cada celda una capacidad: ver, crear, editar o eliminar. Toca una celda para cambiarla.',
        'Pulsa "Guardar cambios". Con "Descartar" deshaces lo que no hayas guardado.',
      ],
      nota: 'La columna Admin no se puede modificar. "Restaurar valores por defecto" devuelve la matriz a su estado original.',
    },
    {
      id: 'crear-rol',
      titulo: 'Crear un rol propio del despacho',
      claves: ['rol personalizado', 'rol custom', 'paralegal', 'contable', 'becario', 'nuevo rol'],
      requiere: { modulo: 'Configuración', capacidad: 'crear' },
      pasos: [
        'Ve a la pestaña "Roles" y pulsa "Crear rol".',
        'Escribe el "Nombre" y la "Descripción".',
        'Elige el "Rol base (seguridad)": marca el límite de lo que el rol nuevo podrá hacer.',
        'En "Permisos del rol", toca las celdas para ajustar cada módulo.',
        'Pulsa "Guardar rol".',
      ],
      nota: 'Las celdas atenuadas no se pueden conceder con ese rol base. Si cambias el rol base, la matriz se reinicia.',
    },
    {
      id: 'solicitudes-permiso',
      titulo: 'Aprobar o rechazar una solicitud de permiso',
      claves: ['solicitud', 'petición', 'acceso denegado', 'pedir permiso', 'sin acceso'],
      requiere: { modulo: 'Configuración', capacidad: 'editar' },
      pasos: [
        'Ve a la pestaña "Solicitudes".',
        'Revisa quién pide el permiso y sobre qué módulo.',
        'Pulsa "Aprobar" o "Rechazar".',
      ],
      nota: 'Las solicitudes llegan cuando alguien entra a una pantalla sin acceso y pulsa "Solicitar permiso al administrador".',
    },
    {
      id: 'eliminar-usuario',
      titulo: 'Eliminar a un usuario del despacho',
      claves: ['borrar', 'dar de baja', 'quitar acceso', 'despedir'],
      requiere: { modulo: 'Configuración', capacidad: 'eliminar' },
      pasos: [
        'En la pestaña "Usuarios", pulsa el usuario en la tabla.',
        'Pulsa "Eliminar usuario".',
        'Confirma con "Sí, eliminar".',
      ],
    },
  ],
};
