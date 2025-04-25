import { EntityManager, ReadonlyEntityManager } from './entity-manager.js';
import { ReadonlySystemManager, SystemManager } from './system-manager.js';
import { WorldDefinition } from './world-definition.js';
import { SignalController } from 'signal-controller';

export class World<
	ParamsType extends Record<string, unknown>,
	ComponentsType extends Record<string, unknown>,
> {
	constructor(
		definition: WorldDefinition<ParamsType, ComponentsType>,
		public readonly params: ParamsType,
	) {
		Object.freeze(params);
		this.entities = new EntityManager(definition);
		this.systems = new SystemManager(definition);
		new Promise<void>(r => queueMicrotask(r)).then(() => this.#controller.emit('ready'));
	}

	#controller = new SignalController<{
		ready(): void;
	}>();
	readonly entities: ReadonlyEntityManager;
	readonly systems: ReadonlySystemManager;
	readonly signals = this.#controller.signal;
}
