import type { Guia } from '../guia';

export const GUIA_PERFIL: Guia = {
  id: 'perfil',
  titulo: 'Mi Perfil',
  modulo: null,
  ruta: '/perfil',
  resumen: 'Tu información personal y profesional dentro de Vertey.',
  paraQue: 'Mantener al día tus datos, los de tu despacho y tu ficha profesional.',
  claves: ['cuenta', 'mis datos', 'usuario', 'ajustes personales'],
  tareas: [
    {
      id: 'editar-perfil',
      titulo: 'Actualizar tus datos',
      claves: ['cambiar nombre', 'teléfono', 'biografía', 'linkedin', 'colegiado', 'especialidad', 'despacho'],
      pasos: [
        'En el menú lateral, pulsa "Mi Perfil".',
        'En "Personal", revisa el "Nombre completo", el "Teléfono", "LinkedIn" y la "Biografía".',
        'En "Despacho", el nombre, la web y la dirección.',
        'En "Profesional", el "Colegio profesional", el "Nº de colegiado", los "Años de experiencia" y la "Especialidad principal".',
        'Pulsa "Guardar cambios".',
      ],
      nota: 'El indicador "Perfil completado" te dice cuánto te falta por rellenar.',
    },
    {
      id: 'info-cuenta',
      titulo: 'Consultar los datos de tu cuenta',
      claves: ['email', 'correo', 'id de usuario', 'miembro desde'],
      pasos: ['En "Mi Perfil", "Información de cuenta" muestra tu "Email", desde cuándo eres miembro y tu "ID de usuario".'],
    },
  ],
};
