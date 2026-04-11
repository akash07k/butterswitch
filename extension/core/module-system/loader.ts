/**
 * @module module-system/loader
 *
 * Orchestrates module lifecycle: dependency resolution, initialization,
 * activation, deactivation, and disposal.
 *
 * Uses Kahn's algorithm for topological sorting — the same approach
 * package managers use to resolve install order. Modules are initialized
 * in dependency order, and deactivation cascades to dependents.
 */

import type { ModuleContext } from "./types.js";
import type { ModuleRegistry } from "./registry.js";

/**
 * Manages the lifecycle of all registered modules.
 *
 * The loader reads from the registry and transitions modules through
 * their lifecycle states: registered → initialized → active ↔ inactive → disposed.
 *
 * Key behaviors:
 * - **Topological initialization** — dependencies are initialized before dependents
 * - **Circular dependency detection** — throws at startup, not at runtime
 * - **Failure propagation** — if a dependency fails, all its dependents are skipped
 * - **Strict cascade deactivation** — disabling a module auto-disables its dependents
 *
 * @example
 * ```ts
 * const loader = new ModuleLoader(registry, context);
 * await loader.initializeAll();
 * await loader.activate("sound-engine");
 * const cascaded = await loader.deactivate("sound-engine");
 * ```
 */
export class ModuleLoader {
  private readonly registry: ModuleRegistry;
  private readonly context: ModuleContext;

  constructor(registry: ModuleRegistry, context: ModuleContext) {
    this.registry = registry;
    this.context = context;
  }

  /**
   * Initialize all registered modules in dependency order.
   *
   * Uses Kahn's algorithm to topologically sort modules by their
   * dependencies, then initializes each in order. If a module fails
   * to initialize, all modules that depend on it are marked as errored
   * and skipped.
   *
   * @throws Error if there's a circular dependency or missing dependency.
   */
  async initializeAll(): Promise<void> {
    const order = this.resolveOrder();

    for (const id of order) {
      const entry = this.registry.get(id)!;

      // Skip if already errored (dependency failed)
      if (entry.state === "error") {
        continue;
      }

      try {
        await entry.module.initialize(this.context);
        this.registry.setState(id, "initialized");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.registry.setError(id, message);

        // Mark all transitive dependents as errored too
        this.propagateError(id, `Dependency "${id}" failed to initialize`);
      }
    }
  }

  /**
   * Activate a module. The module must be initialized and all its
   * dependencies must already be active.
   *
   * @throws Error if the module is not initialized or a dependency is not active.
   */
  async activate(id: string): Promise<void> {
    const entry = this.registry.get(id);
    if (!entry) {
      throw new Error(`Module "${id}" is not registered.`);
    }

    if (entry.state !== "initialized" && entry.state !== "inactive") {
      throw new Error(`Module "${id}" cannot be activated from state "${entry.state}".`);
    }

    // Verify all dependencies are active
    const deps = entry.module.dependencies ?? [];
    for (const depId of deps) {
      const depEntry = this.registry.get(depId);
      if (!depEntry || depEntry.state !== "active") {
        throw new Error(`Cannot activate "${id}": dependency "${depId}" is not active.`);
      }
    }

    await entry.module.activate();
    this.registry.setState(id, "active");
  }

  /**
   * Deactivate a module and cascade to all active dependents.
   *
   * Returns the list of module IDs that were cascade-deactivated
   * (not including the module itself). This list can be used by the
   * UI to show a warning before deactivation.
   *
   * @returns Array of cascade-deactivated module IDs.
   */
  async deactivate(id: string): Promise<string[]> {
    const entry = this.registry.get(id);
    if (!entry) {
      throw new Error(`Module "${id}" is not registered.`);
    }

    if (entry.state !== "active") {
      return [];
    }

    // Find and deactivate all active dependents first (reverse dependency order)
    const cascaded: string[] = [];
    const dependents = this.findActiveDependents(id);

    // Deactivate dependents in reverse order (deepest first)
    for (const depId of dependents.reverse()) {
      const depEntry = this.registry.get(depId)!;
      await depEntry.module.deactivate();
      this.registry.setState(depId, "inactive");
      cascaded.push(depId);
    }

    // Deactivate the module itself
    await entry.module.deactivate();
    this.registry.setState(id, "inactive");

    return cascaded;
  }

  /**
   * Dispose all modules in reverse-dependency order.
   * Dependents are disposed before their dependencies.
   * Called during extension shutdown.
   */
  async disposeAll(): Promise<void> {
    // Reverse the initialization order so dependents are disposed first
    const order = this.resolveOrder().reverse();

    for (const id of order) {
      const entry = this.registry.get(id);
      if (!entry) continue;
      try {
        await entry.module.dispose();
        this.registry.setState(id, "disposed");
      } catch {
        // Best-effort disposal — don't let one failure block others
        this.registry.setState(id, "disposed");
      }
    }
  }

  /**
   * Resolves initialization order using Kahn's algorithm (topological sort).
   *
   * Builds a directed graph of dependencies, then repeatedly picks
   * modules with zero unmet dependencies. If modules remain when no
   * more zero-dependency modules exist, there's a circular dependency.
   *
   * @throws Error if there's a circular dependency or missing dependency.
   * @returns Module IDs in initialization order (dependencies first).
   */
  private resolveOrder(): string[] {
    const ids = this.registry.getIds();

    // Build adjacency list and in-degree count
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const id of ids) {
      inDegree.set(id, 0);
      dependents.set(id, []);
    }

    for (const id of ids) {
      const entry = this.registry.get(id)!;
      const deps = entry.module.dependencies ?? [];

      for (const depId of deps) {
        if (!this.registry.has(depId)) {
          throw new Error(`Module "${id}" depends on "${depId}", which is not registered.`);
        }

        // depId → id (id depends on depId)
        dependents.get(depId)!.push(id);
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      }
    }

    // Kahn's algorithm: start with modules that have no dependencies
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);

      // "Remove" this module's edges by decrementing dependents' in-degree
      for (const depId of dependents.get(id) ?? []) {
        const newDegree = (inDegree.get(depId) ?? 1) - 1;
        inDegree.set(depId, newDegree);
        if (newDegree === 0) {
          queue.push(depId);
        }
      }
    }

    // If not all modules were processed, there's a cycle
    if (order.length !== ids.length) {
      const remaining = ids.filter((id) => !order.includes(id));
      throw new Error(`Circular dependency detected among modules: ${remaining.join(", ")}`);
    }

    return order;
  }

  /**
   * Finds all active modules that transitively depend on the given module.
   * Used by cascade deactivation.
   *
   * @returns Array of dependent module IDs (breadth-first order).
   */
  private findActiveDependents(id: string): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      // Find all modules that list currentId as a dependency
      for (const entry of this.registry.getAll()) {
        const deps = entry.module.dependencies ?? [];
        if (deps.includes(currentId) && entry.state === "active" && !visited.has(entry.module.id)) {
          visited.add(entry.module.id);
          result.push(entry.module.id);
          queue.push(entry.module.id);
        }
      }
    }

    return result;
  }

  /**
   * Marks all transitive dependents of a failed module as errored.
   * Called when a module fails to initialize.
   */
  private propagateError(failedId: string, message: string): void {
    for (const entry of this.registry.getAll()) {
      const deps = entry.module.dependencies ?? [];
      if (deps.includes(failedId) && entry.state !== "error") {
        this.registry.setError(entry.module.id, message);
        // Recursively propagate to further dependents
        this.propagateError(entry.module.id, message);
      }
    }
  }
}
