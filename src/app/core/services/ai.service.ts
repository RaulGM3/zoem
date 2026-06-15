import { inject, Injectable } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  AI,
  GenerativeModel,
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  TypedSchema,
} from 'firebase/ai';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly app = inject(FirebaseApp);
  private ai?: AI;

  private get instance(): AI {
    this.ai ??= getAI(this.app, { backend: new GoogleAIBackend() });
    return this.ai;
  }

  getJsonModel(schema: TypedSchema): GenerativeModel {
    return getGenerativeModel(this.instance, {
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  }
}
