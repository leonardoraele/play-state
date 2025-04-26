import { EntityManager } from './entity-manager.js';
import type { CreateSystemFunction, System, SystemEvent } from './types/system.ts';
import { WorldSettings } from './types/world.js';
import { v4 as uuid } from 'uuid';

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

	dispatchEvent<EventType extends string>(eventType: EventType): void;
	dispatchEvent<EventType extends string, PayloadType>(eventType: EventType, payload: PayloadType): void;
	dispatchEvent<EventType extends string>(eventType: EventType, payload?: unknown): void {
		const event: SystemEvent<EventType> = {
			id: uuid(),
			type: eventType,
			timestampMs: Date.now(),
			payload,
		};
		for (const system of this.systems) {
			try {
				system.handle?.(event);
			} catch (error) {
				console.error('An error occured during handling of a system event.', 'System:', system.name, 'Event:', event.type, 'Error:', error);
			}
		}
	}
}

export type ReadonlySystemManager = Pick<SystemManager, never>;
