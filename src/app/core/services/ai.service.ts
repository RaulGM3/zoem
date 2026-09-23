import { inject, Injectable } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  AI,
  FunctionDeclaration,
  GenerativeModel,
  getAI,
  getGenerativeModel,
  TypedSchema,
  VertexAIBackend,
} from 'firebase/ai';

/**
 * Región de procesamiento de la IA. `eu` es la multirregión europea: mantiene
 * los datos de los despachos dentro de la UE, en coherencia con las Cloud
 * Functions (`europe-west1`) y con las obligaciones de RGPD.
 */
const AI_LOCATION = 'eu';

/**
 * Modelo fijado a una versión estable. La documentación de Firebase AI Logic
 * desaconseja los alias `-latest` incluso en desarrollo: cambian bajo los pies
 * y rompen el comportamiento del agente sin avisar.
 */
const GEMINI_MODEL = 'gemini-3.8-flash';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly app = inject(FirebaseApp);
  private ai?: AI;

  private get instance(): AI {
    // `useLimitedUseAppCheckTokens` es obligatorio: App Check tiene activada la
    // protección contra repetición para Firebase AI Logic, que rechaza los
    // tokens de sesión y solo acepta tokens de uso limitado recién emitidos.
    this.ai ??= getAI(this.app, {
      backend: new VertexAIBackend(AI_LOCATION),
      useLimitedUseAppCheckTokens: true,
    });
    return this.ai;
  }

  getJsonModel(schema: TypedSchema): GenerativeModel {
    return getGenerativeModel(this.instance, {
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  }

  /**
   * Modelo con function calling para el agente conversacional.
   * Sin `responseSchema`: aquí la respuesta es lenguaje natural y, cuando toca,
   * llamadas a herramientas. Se pasa una lista vacía de declaraciones como
   * ausencia de `tools` — Gemini rechaza un bloque de tools vacío.
   */
  getToolModel(
    functionDeclarations: FunctionDeclaration[],
    systemInstruction: string,
  ): GenerativeModel {
    return getGenerativeModel(this.instance, {
      model: GEMINI_MODEL,
      systemInstruction,
      ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
    });
  }
}
