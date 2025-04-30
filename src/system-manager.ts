import { Result } from '@leonardoraele/result';
import { EntityManager } from './entity-manager.js';
import type { BaseEventsType, CreateSystemFunction, PayloadType, ResultType, System, SystemEventController, SystemEvent } from './types/system.ts';
import type { WorldSettings } from './types/world.ts';
import { v4 as uuid } from 'uuid';
import { SignalController } from 'signal-controller';
import { systems as debug } from './util/debug.js';

export class SystemManager<
	EventsType extends BaseEventsType = BaseEventsType,
> {
	static async initialize<
		ParamsType extends Record<string, unknown>,
		ComponentsType extends Record<string, unknown>,
		ViewsType extends Record<string, unknown>,
		EventsType extends BaseEventsType,
	>(
		creatorFunctions: CreateSystemFunction<ParamsType, ComponentsType, ViewsType, EventsType>[],
		entities: EntityManager<ComponentsType>,
		settings: WorldSettings<ParamsType>,
	): Promise<SystemManager<EventsType>> {
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
		private systems: System<EventsType>[],
	) {}

	#queue: SystemEvent<EventsType>[] = [];
	#controller = new SignalController<{
		settled(): void;
		event(event: SystemEvent<EventsType>, result: Result<unknown>|undefined): void;
	}>();
	readonly signals = this.#controller.signal;

	dispatchEvent<TypeName extends keyof EventsType>(eventType: TypeName): void;
	dispatchEvent<TypeName extends keyof EventsType>(eventType: TypeName, payload: PayloadType<EventsType, TypeName>): void;
	dispatchEvent<TypeName extends keyof EventsType>(eventType: TypeName, payload?: any): void {
		const event: SystemEvent<EventsType, TypeName> = {
			id: uuid(),
			type: eventType,
			timestampMs: Date.now(),
			payload,
		};
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
		for (let event: SystemEvent<EventsType>|undefined; event = this.#queue.shift();) {
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
	#processEvent<TypeName extends keyof EventsType>(
		event: SystemEvent<EventsType, TypeName>
	): Result<ResultType<EventsType, TypeName>> {
		let result: Result<ResultType<EventsType, TypeName>>|undefined;
		const controller: SystemEventController<EventsType, TypeName> = {
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
				};
			},
			stack: (eventType, payload) => {
				return this.#processEvent({
					id: uuid(),
					type: eventType,
					timestampMs: Date.now(),
					payload,
					parent: event,
				});
			},
			defer: (eventType, payload) => {
				this.#queue.push({
					id: uuid(),
					type: eventType,
					timestampMs: Date.now(),
					payload,
					parent: event,
				});
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
