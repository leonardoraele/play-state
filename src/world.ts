import { EntityManager, ReadonlyEntityManager } from './entity-manager.js';
import { SystemManager } from './system-manager.js';
import { WorldSettings } from './types/world.js';
import { ReadonlyViewManager, ViewManager } from './view-manager.js';
import { WorldDefinition } from './world-definition.js';
import { SignalController } from 'signal-controller';

export class World<
	ParamsType extends Record<string, unknown>,
	ComponentsType extends Record<string, unknown>,
	ViewsType extends Record<string, unknown> = Record<string, unknown>,
	EventsType extends Record<string, (payload: unknown) => unknown> = Record<string, (payload: unknown) => unknown>,
> {
	constructor(
		definition: WorldDefinition<ParamsType, ComponentsType, ViewsType, EventsType>,
		public readonly params: ParamsType,
	) {
		Object.freeze(params);
		this.settings = { params };
		this.#entities = new EntityManager();
		this.#views = new ViewManager(definition.views, this.#entities, this.settings);
		this.#initialize(definition);
	}

	#controller = new SignalController<{
		ready(world: World<ParamsType, ComponentsType, ViewsType, EventsType>): void;
		error(error: Error): void;
	}>();
	#entities: EntityManager<ComponentsType>;
	#systems: SystemManager<EventsType>|undefined;
	#views: ViewManager<ParamsType, ComponentsType, ViewsType>;
	readonly settings: WorldSettings<ParamsType>;
	readonly signals = this.#controller.signal;

	get entities(): ReadonlyEntityManager<ComponentsType> {
		return this.#entities;
	}

	get systems(): SystemManager<EventsType> {
		if (!this.#systems) {
			throw new Error('Failed to read `World.systems` property. Cause: World is not ready yet. You should wait for the `ready` event before accessing this property.');
		}
		return this.#systems;
	}

	get views(): ReadonlyViewManager<ParamsType, ComponentsType, ViewsType> {
		return this.#views;
	}

	async #initialize(definition: WorldDefinition<ParamsType, ComponentsType, ViewsType, EventsType>): Promise<void> {
		definition.entitites.forEach(entity => this.#entities.addEntity(entity));
		try {
			this.#systems = await SystemManager.initialize(definition.systems, this.#entities, this.settings);
			this.#controller.emit('ready', this);
		} catch (cause) {
			this.#controller.emit('error', cause instanceof Error ? cause : new Error('Failed to initialize World. Cause: One or more systems failed to initialize.', { cause }));
		}
	}
}
