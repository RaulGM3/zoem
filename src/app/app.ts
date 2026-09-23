import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import { ToastContainerComponent } from './core/ui/toast-container/toast-container';
import { UploadProgressComponent } from './core/ui/upload-progress/upload-progress';
import { PlatformService } from './core/services/platform.service';

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
export class App implements OnInit {
  private readonly platform = inject(PlatformService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  async ngOnInit(): Promise<void> {
    this.dismissLoader();
    if (!this.platform.isNative) return;
    await this.initNative();
  }

  private dismissLoader(): void {
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      take(1),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      const loader = document.getElementById('app-loader');
      if (!loader) return;
      loader.classList.add('fade-out');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    });
  }

  private async initNative(): Promise<void> {
    const [{ StatusBar, Style }, { App }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/app'),
    ]);

    if (this.platform.isIos) {
      await StatusBar.setStyle({ style: Style.Default });
      document.body.classList.add('native-ios');
    }

    if (this.platform.isAndroid) {
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
      await StatusBar.setStyle({ style: Style.Default });

      let backPressedOnce = false;
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          this.location.back();
          return;
        }
        if (backPressedOnce) {
          App.exitApp();
          return;
        }
        backPressedOnce = true;
        setTimeout(() => { backPressedOnce = false; }, 2000);
      });
    }
  }
}
