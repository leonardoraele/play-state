import { WorldDefinition } from './world-definition';

export class EntityManager {
	constructor(definition: WorldDefinition) {
		definition.components.forEach(type => this.addComponentType(type));
		definition.entitites.forEach(entity => this.addEntity(entity));
	}

	#componentTypes: ComponentDefinition[] = [];
	#entityIndex: Map<string, Entity> = new Map();

	get componentTypes(): readonly ComponentDefinition[] {
		return this.#componentTypes;
	}

	addComponentType(definition: ComponentDefinition): void {
		this.#componentTypes.push(definition);
	}

	addEntity(entity: Entity, ): void {
		this.#entityIndex.set(entity.id, entity);
	}

	removeEntity(id: string): void {
		this.#entityIndex.delete(id);
	}
}

export type ReadonlyEntityManager = Pick<EntityManager, 'componentTypes'>;
