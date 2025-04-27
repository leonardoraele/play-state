import { Result } from '@leonardoraele/result';
import { EntityManager } from './entity-manager.js';
import type { BaseEventsType, CreateSystemFunction, PayloadType, ResultType, System, SystemDispatchController, SystemEvent } from './types/system.ts';
import type { WorldSettings } from './types/world.ts';
import { v4 as uuid } from 'uuid';
import { SignalController } from 'signal-controller';

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
		const systems = await Promise.all(creatorFunctions.map(createSystem => createSystem(entities, settings)));
		const manager = new SystemManager(systems);
		for (const system of systems) {
			system.ready?.(manager);
		}
		return manager;
	}

	constructor(
		private systems: System<EventsType>[],
	) {}

	#queue: SystemEvent<EventsType>[] = [];
	#controller = new SignalController<{
		settled(): void;
		event(event: SystemEvent<EventsType>, result: Result<unknown>): void;
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
		this.#queue.push(event);
		if (this.#queue.length === 1) {
			queueMicrotask(() => this.#processQueue());
		}
	}

	#processQueue(): void {
		// When the system starts the event delivery routine (now), the event queue is transformed into a stack. The
		// queued events will still be handled in FIFO order, since the first event queued will be at the top of the
		// stack, however, if new events are stacked during the event handling process, they will be prioritized
		// (stacked on top of existing events).
		const stack = this.#queue.reverse();
		this.#queue = [];

		while (stack.length > 0) {
			let event = stack.pop()!;
			let result: Result<unknown> = processEvent.call(this, event);
			result.rescue(console.error);
			this.#controller.emit('event', event, result);
		}

		this.#controller.emit('settled');

		function processEvent<TypeName extends keyof EventsType>(
			this: SystemManager<EventsType>,
			event: SystemEvent<EventsType, TypeName>
		): Result<ResultType<EventsType, TypeName>> {
			let result: Result<ResultType<EventsType, TypeName>>|undefined;
			const controller: SystemDispatchController<EventsType, TypeName> = {
				set(result) {
					result = result;
				},
				handled(data) {
					result = Result.ok(data);
				},
				failed(error) {
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
					return processEvent.call(this, {
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
					console.debug(SystemManager.name, { event }, ...info);
				},
			};
			for (const system of this.systems) {
				try {
					system.handle?.(event, controller);
				} catch (error) {
					result = Result.err(error instanceof Error ? error : String(error))
						.mapErr(error => error.causes('An error occured during handling of a system event.').with({
							system: system.name,
							event: event.type,
						}));
				}
				if (result) {
					break;
				}
			}
			result ??= Result.err('Failed to handle event. Cause: The event has been delivered to all systems and none have handled it.')
				.mapErr(error => error.with({ eventType: event.type }));
			return result;
		}
	}
}

export type ReadonlySystemManager = Pick<SystemManager, 'signals'>;
