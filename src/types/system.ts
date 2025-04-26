import { Result } from '@leonardoraele/result';
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
	handle?(event: SystemEvent, controller: SystemDispatchController): void;
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

export interface SystemDispatchController {
	/** Signals that the event has been handled and sets the result. */
	set(result: Result<unknown>): void;
	/** Signals that the event has been handled successfully, and optionally
	 * provide resulting data that can be read by the emitter system. */
	handled(data?: unknown): void;
	/** Signals that the event has been handled, but the resulting activity
	 * has failed. Optionally provides an error object that describes the
	 * cause of the failure. */
	failed(error?: Error): void;
	/** Creates a new event with the same type as the event currently being
	 * handled, and signals that the new event should be dispatched to subsequent
	 * systems in the handle pipeline instead of the current event.*/
	forward(payload: unknown): void;
	/** Dispatch a new event, but the resolution of the new event is ignored. This
	 * means if success() or failure() is not called during the current event
	 * handling, subsequent systems in the pipeline will still be called after
	 * this handler returns control, though the new event is handled first.*/
	stack(eventType: string, payload: unknown): Result<unknown>;
	// /** Dispatch a new event and signals that the current event is handled by the
	//  * resolution of the new event. This means this event handles as success if
	//  * the new event succeeds, and as failure if the new event fails. */
	// replaceWith(eventType: string, payload: unknown): void;
	/** Dispatch a new event, but queues it at the bottom of the current event,
	 * handling stack, so that it is only handled later. */
	defer(eventType: string, payload: unknown): void;
	// /** Dispatch a new event and waits for its resolution. The returned promise
	//  * resolves with the success data of the new event if it's handled
	//  * successfully, or rejects with the error of the new event if it fails. */
	// request(eventType: string, payload: unknown): Result<unknown>;
	/** Logs debug information to the system. */
	debug(...info: unknown[]): void;
}
