import { Buffer } from 'buffer';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// html-to-docx requiere los globals de Node (global/Buffer) en el navegador
(globalThis as Record<string, unknown>)['global'] ??= globalThis;
(globalThis as Record<string, unknown>)['Buffer'] ??= Buffer;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
