import { inject, Injectable } from '@angular/core';
import type { FunctionDeclaration } from 'firebase/ai';
import { PermissionService } from '../services/permission.service';
import { AGENT_TOOLS } from './agent-tools';
import { toolFail, type AgentTool, type ToolArgs, type ToolResult } from './agent-tool';

/**
 * Catálogo de herramientas del agente — el corazón de la arquitectura.
 *
 * Es deliberadamente agnóstico del transporte: no sabe si quien pregunta es el
 * chat de texto, el de voz o un futuro servidor MCP. Añadir una capacidad nueva
 * al agente = escribir una `AgentTool` y registrarla acá. Nada más se toca.
 *
 * El permiso se comprueba DOS veces y no es redundancia:
 *  - en `declarations()` para que el modelo ni sepa que la tool existe (así no
 *    le promete al usuario algo que no va a poder hacer);
 *  - en `run()` porque el modelo puede inventarse un nombre de función.
 */
@Injectable({ providedIn: 'root' })
export class AgentToolRegistry {
  private readonly perm = inject(PermissionService);
  private readonly tools = new Map<string, AgentTool>();

  constructor() {
    // Las tools llegan por DI (ver `provideAgentTools`). En los tests el token
    // no está provisto y el registry nace vacío, que es justo lo que se quiere.
    for (const grupo of inject(AGENT_TOOLS, { optional: true }) ?? []) {
      this.registerAll(grupo);
    }
  }

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Ya hay una tool registrada con el nombre "${tool.name}".`);
    }
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: readonly AgentTool[]): void {
    for (const tool of tools) this.register(tool);
  }

  /** ¿Tiene el usuario actual permiso para esta tool? Sin permiso declarado = sí. */
  private permitida(tool: AgentTool): boolean {
    const p = tool.permission;
    return !p || this.perm.can(p.modulo, p.cap);
  }

  /**
   * Lo que se le manda a Gemini como `tools`, ya filtrado por permisos.
   * `soloLectura` deja fuera todo lo que no sea capacidad "ver": es lo que
   * separa el modo "soporte" (consultar y navegar) del modo "acciones".
   */
  declarations(opts?: { soloLectura?: boolean }): FunctionDeclaration[] {
    return [...this.tools.values()]
      .filter((tool) => this.permitida(tool))
      .filter((tool) => !opts?.soloLectura || !tool.permission || tool.permission.cap === 'ver')
      .map(({ name, description, parameters }) => ({ name, description, parameters }));
  }

  /**
   * Ejecuta una tool por nombre. NUNCA lanza: todo fallo vuelve como `ToolResult`
   * para que el loop lo reenvíe al modelo y este pueda explicárselo al usuario o
   * intentar otro camino.
   */
  async run(name: string, args: ToolArgs): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return toolFail(`No existe ninguna herramienta llamada "${name}".`);

    if (!this.permitida(tool)) {
      const { modulo, cap } = tool.permission!;
      return toolFail(this.perm.denyMessage(modulo, cap));
    }

    try {
      return await tool.execute(args);
    } catch (e) {
      return toolFail(e instanceof Error ? e.message : `Fallo al ejecutar "${name}".`);
    }
  }
}
