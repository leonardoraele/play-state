// import type { ComponentDefinition } from './types/component.ts';
import { ExtraIterator } from 'extra-iterator';
import type { Entity, SubEntityOf } from './types/entity.ts';

const GROUP_MAX_SIZE = 100;

export class EntityManager<ComponentsType extends Record<string, unknown> = Record<string, unknown>> {
	// #componentTypes: ComponentDefinition[] = [];
	#entityIndex = new Map<string, SubEntityOf<ComponentsType>>();
	#entityGroups = new EntityGroupCollection();

	// get componentTypes(): readonly ComponentDefinition[] {
	// 	return this.#componentTypes;
	// }

	// addComponentType(definition: ComponentDefinition): void {
	// 	this.#componentTypes.push(definition);
	// }

	addEntity(entity: SubEntityOf<ComponentsType>): void {
		if (this.#entityIndex.has(entity.id)) {
			return;
		}
		this.#entityIndex.set(entity.id, entity);
		this.#entityGroups.addEntity(entity);
	}

	removeEntityById(id: string): void {
		const entity = this.#entityIndex.get(id);
		if (!entity) {
			return;
		}
		this.removeEntity(entity);
	}

	removeEntity(entity: Entity): void {
		this.#entityIndex.delete(entity.id);
		this.#entityGroups.removeEntity(entity);
	}

	queryId(id: string): SubEntityOf<ComponentsType> | undefined {
		return this.#entityIndex.get(id);
	}

	queryTypes<TypeUnion extends string>(requiredTypes: TypeUnion[]): ExtraIterator<SubEntityOf<ComponentsType, TypeUnion>> {
		return this.#entityGroups.queryTypes(requiredTypes) as any;
	}
}

class EntityGroupCollection {
	#groups: EntityGroup[] = [];

	addEntity(entity: Entity): void {
		const componentTypes = new Set(Object.keys(entity.data));
		const group = this.#groups.find(group =>
				componentTypes.symmetricDifference(group.componentTypes).size === 0 // Checks if both sets are equal
				&& group.entities.length < GROUP_MAX_SIZE
			)
			?? (this.#groups[this.#groups.length - 1] = {
				componentTypes,
				entities: [],
			} satisfies EntityGroup);
		group.entities.push(entity);
	}

	removeEntity(entity: Entity): void {
		const componentTypes = new Set(Object.keys(entity.data));
		for (const group of this.#groups) {
			if (componentTypes.symmetricDifference(group.componentTypes).size === 0) {
				const index = group.entities.indexOf(entity);
				if (index === -1) {
					group.entities.splice(index, 1);
				}
			}
		}
		this.#groups = this.#groups.filter(group => group.entities.length > 0);
	}

	queryTypes(requiredTypes: string[]): ExtraIterator<Entity> {
		const requiredSet = new Set(requiredTypes);
		return ExtraIterator.from(this.#groups)
			.filter(group => group.componentTypes.isSupersetOf(requiredSet))
			.flatMap(group => group.entities);
	}
}

interface EntityGroup {
	componentTypes: Set<string>;
	entities: Entity[];
}

export type ReadonlyEntityManager<ComponentsType extends Record<string, unknown> = Record<string, unknown>>
	= Pick<EntityManager<ComponentsType>, 'queryId'|'queryTypes'>;
