import { v4 as uuid } from 'uuid';
import { ExtraIterator } from 'extra-iterator';
import { World } from './world.js';

export class WorldDefinition<
	ParamsType extends Record<string, unknown> = Record<string, unknown>,
	ComponentsType extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly components: ComponentDefinition[] = [];
	readonly entitites: Entity[] = [];
	readonly systems: System[] = [];

	withParameters<NewParamsType extends ParamsType>(
	): WorldDefinition<NewParamsType, ComponentsType> {
		return this as any;
	}

	withComponent<TypeName extends string, Data>(
		definition: ComponentDefinition<TypeName, Data>,
	): WorldDefinition<ParamsType, ComponentsType & Record<TypeName, Data>> {
		this.components.push(definition);
		return this;
	}

	withEntity(
		entity: Partial<Entity<Partial<ComponentsType>>>
	): this {
		this.entitites.push({
			id: entity.id ?? uuid(),
			data: {
				...ExtraIterator.from(this.components)
					.map(type => [type.type, type.initialData ? structuredClone(type.initialData) : {}])
					.collect(Object.fromEntries),
				...entity.data,
			},
		});
		return this;
	}

	withSystem(
		system: System,
	): WorldDefinition<ParamsType, ComponentsType> {
		this.systems.push(system);
		return this;
	}

	instantiate(params: ParamsType): World<ParamsType, ComponentsType> {
		return new World(this, params);
	}
}

export function beginWorldDefinition(): WorldDefinition<{}, {}> {
	return new WorldDefinition();
}
