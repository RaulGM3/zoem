import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UsuariosComponent } from '../../../usuarios/usuarios';

@Component({
  selector: 'app-usuarios-seccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UsuariosComponent],
  template: `<app-usuarios [embebido]="true" />`,
})
export class UsuariosSeccionComponent {}
