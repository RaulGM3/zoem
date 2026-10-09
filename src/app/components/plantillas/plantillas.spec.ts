import { describe, it, expect, beforeEach } from 'vitest';
import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BloqueoPlanService } from '../../core/planes/bloqueo-plan.service';
import { MejoraPlanService } from '../../core/planes/mejora-plan.service';
import { PlanService } from '../../core/planes/plan.service';
import { PlantillasService } from '../../core/services/plantillas.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users';
import { PlantillasComponent } from './plantillas';
import { PlantillasHeaderComponent } from './components/plantillas-header/plantillas-header';
import { PlantillasListComponent } from './components/plantillas-list/plantillas-list';
import { PlantillaDrawerComponent } from './components/plantilla-drawer/plantilla-drawer';

@Component({ selector: 'app-plantillas-header', template: '' })
class HeaderStub { readonly newPlantilla = output<void>(); }
@Component({ selector: 'app-plantillas-list', template: '' })
class ListStub {
  readonly plantillas = input<unknown>();
  readonly loading = input<boolean>();
  readonly delete = output<string>();
  readonly newPlantilla = output<void>();
}
@Component({ selector: 'app-plantilla-drawer', template: '' })
class DrawerStub {
  readonly plantilla = input<unknown>();
  readonly members = input<unknown>();
  readonly tipos = input<unknown>();
  readonly tiposCosto = input<unknown>();
  readonly saved = output<void>();
  readonly closed = output<void>();
}

const plantillas = signal<unknown[]>([]);
const limite = signal(5);

const abrirCupo = vi.fn();

function montar() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: PlantillasService, useValue: { plantillas, loading: signal(false), loadPlantillas: async () => undefined } },
      { provide: UsersService, useValue: { members: signal([]), loadMembers: async () => undefined } },
      { provide: ToastService, useValue: {} },
      { provide: PlanService, useValue: { limite: () => limite() } },
      { provide: BloqueoPlanService, useValue: { abrirCupo: (l: string, u: number) => { abrirCupo(l, u); TestBed.inject(MejoraPlanService).abrir(); } } },
    ],
  });
  TestBed.overrideComponent(PlantillasComponent, {
    remove: { imports: [PlantillasHeaderComponent, PlantillasListComponent, PlantillaDrawerComponent] },
    add: { imports: [HeaderStub, ListStub, DrawerStub] },
  });
  const f = TestBed.createComponent(PlantillasComponent);
  f.detectChanges();
  return f;
}

describe('PlantillasComponent — cupo del plan', () => {
  beforeEach(() => {
    plantillas.set([{}, {}, {}]);
    limite.set(5);
  });

  it('muestra el medidor "3/5 plantillas"', () => {
    const f = montar();
    expect((f.nativeElement as HTMLElement).querySelector('app-cupo')?.textContent).toContain('3/5 plantillas');
  });

  it('con cupo libre abre el formulario', () => {
    const f = montar();
    f.componentInstance.openNew();
    expect(f.componentInstance.showForm()).toBe(true);
    expect(TestBed.inject(MejoraPlanService).abierto()).toBe(false);
  });

  it('con cupo agotado NO abre el formulario y abre el modal de mejora', () => {
    plantillas.set([{}, {}, {}, {}, {}]);
    const f = montar();
    f.componentInstance.openNew();
    expect(f.componentInstance.showForm()).toBe(false);
    expect(TestBed.inject(MejoraPlanService).abierto()).toBe(true);
    expect(abrirCupo).toHaveBeenCalledWith('plantillas', 5); // el modal explica la causa con el recuento real
  });

  it('plan ilimitado nunca bloquea', () => {
    limite.set(Infinity);
    plantillas.set(new Array(500).fill({}));
    const f = montar();
    f.componentInstance.openNew();
    expect(f.componentInstance.showForm()).toBe(true);
  });
});
