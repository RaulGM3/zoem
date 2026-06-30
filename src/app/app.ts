import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './core/ui/toast-container/toast-container';
import { UploadProgressComponent } from './core/ui/upload-progress/upload-progress';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, UploadProgressComponent],
  template: `
    <router-outlet />
    <app-toast-container />
    <app-upload-progress />
  `,
  styles: [],
})
export class App {}
