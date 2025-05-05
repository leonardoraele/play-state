import { v4 as uuid } from 'uuid';
import { World } from './world.js';
import { SubEntityOf } from './types/entity.js';
import type { CreateSystemFunction, SystemEvent } from './types/system.ts';
import { View } from './types/view.js';

export type EmptyWorldDefinition = WorldDefinition<{}, {}, {}, never>;
export type Plugin<T extends WorldDefinition> = (definition: EmptyWorldDefinition) => T;

export class WorldDefinition<
	ParamsType extends Record<string, unknown> = Record<string, unknown>,
	ComponentsType extends Record<string, unknown> = Record<string, unknown>,
	ViewsType extends Record<string, unknown> = Record<string, unknown>,
	EventUnionType extends SystemEvent = SystemEvent,
> {
	readonly entitites: SubEntityOf<ComponentsType>[] = [];
	readonly systems: CreateSystemFunction<ParamsType, ComponentsType, ViewsType, EventUnionType>[] = [];
	readonly views: View<ParamsType, ComponentsType>[] = [];

	withParameters<NewParamsType extends ParamsType>(
	): WorldDefinition<NewParamsType, ComponentsType, ViewsType, EventUnionType> {
		return this as any;
	}

	withComponents<AdditionalComponentsType extends Record<string, unknown>>(
	): WorldDefinition<ParamsType, ComponentsType & AdditionalComponentsType, ViewsType, EventUnionType> {
		return this as any;
	}

	withEntity(id: string, data: Partial<ComponentsType>): this;
	withEntity(data: Partial<ComponentsType>): this;
	withEntity(...args: any[]): this {
		const [id, data]: [string, Partial<ComponentsType>] = args.length === 1 ? [uuid(), args[0]] : [args[0], args[1]];
		this.entitites.push({ id, data } as SubEntityOf<ComponentsType>);
		return this;
	}

	withView<NameType extends string, DataType>(
		view: View<ParamsType, ComponentsType, NameType, DataType>,
	): WorldDefinition<ParamsType, ComponentsType, ViewsType & Record<NameType, DataType>, EventUnionType> {
		this.views.push(view);
		return this as any;
	}

	withEvent<EventName extends string, EventPayloadType>(
	): WorldDefinition<ParamsType, ComponentsType, ViewsType, EventUnionType | SystemEvent<EventName, EventPayloadType>> {
		return this;
	}

	withSystem(system: CreateSystemFunction<ParamsType, ComponentsType, ViewsType, EventUnionType>): this {
		this.systems.push(system);
		return this;
	}

	use<
		ExtraParamsType extends Record<string, unknown>,
		ExtraComponentsType extends Record<string, unknown>,
		ExtraViewsType extends Record<string, unknown>,
		ExtraEventUnionType extends SystemEvent,
	>(
		plugin: (definition: EmptyWorldDefinition) => WorldDefinition<ExtraParamsType, ExtraComponentsType, ExtraViewsType, ExtraEventUnionType>
	): WorldDefinition<
		ParamsType & ExtraParamsType,
		ComponentsType & ExtraComponentsType,
		ViewsType & ExtraViewsType,
		EventUnionType | ExtraEventUnionType
	> {
		return plugin(this as any) as any;
	}

	instantiate(params: ParamsType): World<ParamsType, ComponentsType, ViewsType, EventUnionType> {
		return new World(this, params);
	}
}

export function beginWorldDefinition(): EmptyWorldDefinition {
	return new WorldDefinition();
}
