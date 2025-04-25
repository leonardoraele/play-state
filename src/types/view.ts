import type { EntityManager } from '../entity-manager.ts';
import { WorldSettings } from './world.js';

export interface View<
	ParamsType extends Record<string, unknown> = Record<string, unknown>,
	ComponentsType extends Record<string, unknown> = Record<string, unknown>,
	NameType extends string = string,
	DataType extends unknown = unknown,
> {
	name: NameType;
	selector(entities: EntityManager<ComponentsType>, settings: WorldSettings<ParamsType>): DataType;
}
