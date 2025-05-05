import { Result } from '@leonardoraele/result';
import { EntityManager } from './entity-manager.js';
import type { CreateSystemFunction, System, SystemEventController, SystemEvent } from './types/system.ts';
import type { WorldSettings } from './types/world.ts';
import { v4 as uuid } from 'uuid';
import { SignalController } from 'signal-controller';
import { systems as debug } from './util/debug.js';

export class SystemManager<
	EventUnionType extends SystemEvent = never,
> {
	static async initialize<
		ParamsType extends Record<string, unknown>,
		ComponentsType extends Record<string, unknown>,
		ViewsType extends Record<string, unknown>,
		EventUnionType extends SystemEvent,
	>(
		creatorFunctions: CreateSystemFunction<ParamsType, ComponentsType, ViewsType, EventUnionType>[],
		entities: EntityManager<ComponentsType>,
		settings: WorldSettings<ParamsType>,
	): Promise<SystemManager<EventUnionType>> {
		debug('initialize', '⏳ Initializing systems...')
		const systems = await Promise.all(creatorFunctions.map(async createSystem => createSystem(entities, settings)));
		const manager = new SystemManager(systems);
		debug('initialize', '⏳ Calling `ready()` on systems...');
		for (const system of systems) {
			system.ready?.(manager);
		}
		debug('initialize', '✅ Initialization complete. All systems are ready.');
		return manager;
	}

	constructor(
		private systems: System<EventUnionType>[],
	) {}

	#queue: EventUnionType[] = [];
	#controller = new SignalController<{
		settled(): void;
		event(event: EventUnionType, result: Result<unknown>|undefined): void;
	}>();
	readonly signals = this.#controller.signal;

	dispatchEvent<EventType extends EventUnionType>(eventType: EventType['type']): void;
	dispatchEvent<EventType extends EventUnionType>(eventType: EventType['type'], payload: EventType['payload']): void;
	dispatchEvent(eventType: string, payload: unknown): void;
	dispatchEvent(eventType: string, payload?: unknown): void {
		const event = {
			id: uuid(),
			type: eventType,
			timestampMs: Date.now(),
			payload,
		} satisfies SystemEvent as EventUnionType;
		debug('event-queued', 'Event added to queue.', event);
		this.#queue.push(event);
		if (this.#queue.length === 1) {
			queueMicrotask(() => this.#processQueue());
		}
	}

	#processQueue(): void {
		if (this.#queue.length === 0) {
			debug('process-queue', 'Event queue is empty. No events to process.');
			return;
		}
		debug('process-queue', '▶ Starting processing event queue...', `(${this.#queue.length} events in queue.)`);
		for (let event: EventUnionType|undefined; event = this.#queue.shift();) {
			debug('process-queue', 'Processing event', event.id, event);
			const result: Result<unknown> = this.#processEvent(event);
			if (result.isErr()) {
				console.error(result.error);
			}
			debug('process-queue', result.isOk() ? '✔ Event processed successfully.' : '✖ Event processing failed.', { id: event.id, result }, 'Remaining events in queue:', this.#queue.length);
		}
		debug('process-queue', '✅ Event queue processed. Systems settled.');
		this.#controller.emit('settled');
	}

	/** Runs an event through each systems until one of them handles it, then returns the result. */
	#processEvent(event: EventUnionType): Result<unknown> {
		let result: Result<unknown>|undefined;
		const controller: SystemEventController<EventUnionType> = {
			set(result) {
				result = result;
			},
			setHandled(data) {
				result = Result.ok(data);
			},
			setFailed(error) {
				result = Result.err(error ?? 'Event handling failure.');
			},
			forward(payload) {
				event = {
					id: uuid(),
					type: event.type,
					timestampMs: Date.now(),
					payload,
					parent: event,
				} satisfies SystemEvent as EventUnionType;
			},
			stack: (eventType, payload) => {
				return this.#processEvent({
					id: uuid(),
					type: eventType,
					timestampMs: Date.now(),
					payload,
					parent: event,
				} satisfies SystemEvent as EventUnionType);
			},
			defer: (eventType, payload) => {
				this.#queue.push({
					id: uuid(),
					type: eventType,
					timestampMs: Date.now(),
					payload,
					parent: event,
				} satisfies SystemEvent as EventUnionType);
			},
			debug(...info) {
				debug('handle-debug', event.type, { event }, ...info);
			},
		};
		for (const system of this.systems) {
			try {
				system.handle?.(event, controller);
			} catch (error) {
				result = Result.err(error instanceof Error ? error : String(error))
					.mapErr(error => error.causes('An error occured during handling of a system event.').with({
						system: system.name,
						eventType: event.type,
					}));
			}
			if (result) {
				break;
			}
		}
		this.#controller.emit('event', event, result);
		result ??= Result.err('Failed to handle event. Cause: The event has been delivered to all systems and none have handled it.')
			.mapErr(error => error.with({ eventType: event.type }));
		return result;
	}
}

export type ReadonlySystemManager = Pick<SystemManager, 'signals'>;
