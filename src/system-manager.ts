import { WorldDefinition } from './world-definition';

export class SystemManager {
	constructor(definition: WorldDefinition) {
		definition.systems.forEach(system => this.addSystem(system));
	}

	#systems: System[] = [];

	addSystem(system: System) {
		this.#systems.push(system);
	}
}

export type ReadonlySystemManager = Pick<SystemManager, never>;
