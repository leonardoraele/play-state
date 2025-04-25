import { EntityManager } from './entity-manager.js';
import type { CreateSystemFunction, System } from './types/system.ts';
import { WorldSettings } from './types/world.js';

export class SystemManager {
	static async initialize<
		ParamsType extends Record<string, unknown>,
		ComponentsType extends Record<string, unknown>,
	>(
		creatorFunctions: CreateSystemFunction<ParamsType, ComponentsType>[],
		entities: EntityManager<ComponentsType>,
		settings: WorldSettings<ParamsType>,
	): Promise<SystemManager> {
		const systems = await Promise.all(creatorFunctions.map(createSystem => createSystem(entities, settings)));
		const manager = new SystemManager(systems);
		for (const system of systems) {
			system.ready?.(manager);
		}
		return manager;
	}

	constructor(
		private systems: System[],
	) {}

	dispatchEvent(eventType: string, payload?: unknown): void {

	}
}

export type ReadonlySystemManager = Pick<SystemManager, never>;
