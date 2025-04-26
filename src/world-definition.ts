import { v4 as uuid } from 'uuid';
import { World } from './world.js';
import { SubEntityOf } from './types/entity.js';
import type { CreateSystemFunction } from './types/system.ts';
import { View } from './types/view.js';

export class WorldDefinition<
	ParamsType extends Record<string, unknown> = Record<string, unknown>,
	ComponentsType extends Record<string, unknown> = Record<string, unknown>,
	ViewsType extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly entitites: SubEntityOf<ComponentsType>[] = [];
	readonly systems: CreateSystemFunction<ParamsType, ComponentsType>[] = [];
	readonly views: View<ParamsType, ComponentsType>[] = [];

	withParameters<NewParamsType extends ParamsType>(
	): WorldDefinition<NewParamsType, ComponentsType> {
		return this as any;
	}

	withComponents<AdditionalComponentsType extends Record<string, unknown>>(
	): WorldDefinition<ParamsType, ComponentsType & AdditionalComponentsType> {
		return this as any;
	}

	withEntity(id: string, data: Partial<ComponentsType>): this;
	withEntity(data: Partial<ComponentsType>): this;
	withEntity(...args: any[]): this {
		const [id, data]: [string, Partial<ComponentsType>] = args.length === 1 ? [uuid(), args[0]] : [args[0], args[1]];
		this.entitites.push({ id, data } as SubEntityOf<ComponentsType>);
		return this;
	}

	withSystem(system: CreateSystemFunction<ParamsType, ComponentsType>): this {
		this.systems.push(system);
		return this;
	}

	withView<NameType extends string, DataType>(
		view: View<ParamsType, ComponentsType, NameType, DataType>,
	): WorldDefinition<ParamsType, ComponentsType, ViewsType & Record<NameType, DataType>> {
		this.views.push(view);
		return this as any;
	}

	use<
		NewParamsType extends Record<string, unknown>,
		NewComponentsType extends Record<string, unknown>,
		NewViewsType extends Record<string, unknown>,
	>(
		plugin: (definition: WorldDefinition) => WorldDefinition<NewParamsType, NewComponentsType, NewViewsType>,
	): WorldDefinition<ParamsType & NewParamsType, ComponentsType & NewComponentsType, ViewsType & NewViewsType>
	{
		return plugin(this as any) as any;
	}

	instantiate(params: ParamsType): World<ParamsType, ComponentsType, ViewsType> {
		return new World(this, params);
	}
}

export function beginWorldDefinition(): WorldDefinition<{}, {}> {
	return new WorldDefinition();
}
