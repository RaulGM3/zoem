import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Funcion } from '../../core/planes/catalogo';
import { MejoraPlanService } from '../../core/planes/mejora-plan.service';
import { textosMejora } from '../../core/planes/textos-mejora';
import { PaginaBloqueadaComponent } from '../../shared/components/pagina-bloqueada/pagina-bloqueada';

/**
 * Contenedor de la ruta gemela "bloqueada" (ver `rutaConPlan`): resuelve los textos
 * de la función desde `route.data.funcion` y conecta el CTA con el modal de mejora.
 */
@Component({
  selector: 'app-pagina-bloqueada-ruta',
  imports: [PaginaBloqueadaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-pagina-bloqueada [titulo]="texto().titulo" [descripcion]="texto().descripcion"
      [beneficios]="texto().beneficios" (mejorar)="mejora.abrir(funcion())" />
  `,
})
export class PaginaBloqueadaRutaComponent {
  protected readonly mejora = inject(MejoraPlanService);
  private readonly route = inject(ActivatedRoute);

  protected readonly funcion = computed(() => this.route.snapshot.data['funcion'] as Funcion);
  protected readonly texto = computed(() => textosMejora(this.funcion()));
}
