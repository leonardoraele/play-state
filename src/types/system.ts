import type { EntityManager } from '../entity-manager.js';
import type { SystemManager } from '../system-manager.js';
import type { WorldSettings } from './world.ts';

export type CreateSystemFunction<
		ParamsType extends Record<string, unknown> = Record<string, unknown>,
		ComponentsType extends Record<string, unknown> = Record<string, unknown>,
	>
	= (em: EntityManager<ComponentsType>, ws: WorldSettings<ParamsType>) => System|Promise<System>;

export interface System {
	readonly name: string;
	getDisplayName?(): string;
	ready?(systems: SystemManager): void;
	handle?(event: SystemEvent): void;
}

export interface SystemEvent<TypeName extends string = string, PayloadType = unknown> {
	/** Unique identifier of this event instance. */
	id: string;
	/** Identifier of the type of event. This determines the shape of the event's
	 * payload. */
	type: TypeName;
	/** Moment in time when the event was created. This is a milisecond-based
	 * Unix timestamp. */
	timestampMs: number;
	/** Event data. Set to `null` when there is no data to be transmitted. */
	payload: PayloadType;
	/** If this event was generated during the handling of another event, then
	 * this property points to that event. */
	parent?: SystemEvent;
}
