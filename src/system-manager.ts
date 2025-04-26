import { Result } from '@leonardoraele/result';
import { EntityManager } from './entity-manager.js';
import type { CreateSystemFunction, System, SystemDispatchController, SystemEvent } from './types/system.ts';
import type { WorldSettings } from './types/world.ts';
import { v4 as uuid } from 'uuid';
import { SignalController } from 'signal-controller';

export class SystemManager {
	static async initialize<
		ParamsType extends Record<string, unknown>,
		ComponentsType extends Record<string, unknown>,
	>(
		creatorFunctions: CreateSystemFunction<ParamsType, ComponentsType>[],
		entities: EntityManager<ComponentsType>,
		settings: WorldSettings<ParamsType>,
	): Promise<SystemManager> {
		const systems = await Promise.all(creatorFunctions.map(createSystem => createSystem(entities, settings)));
		const manager = new SystemManager(systems);
		for (const system of systems) {
			system.ready?.(manager);
		}
		return manager;
	}

	constructor(
		private systems: System[],
	) {}

	#queue: SystemEvent[] = [];
	#controller = new SignalController<{
		settled(): void;
		event(event: SystemEvent, result: Result<unknown>): void;
	}>();
	readonly signals = this.#controller.signal;

	dispatchEvent<EventType extends string>(eventType: EventType): void;
	dispatchEvent<EventType extends string, PayloadType>(eventType: EventType, payload: PayloadType): void;
	dispatchEvent<EventType extends string>(eventType: EventType, payload?: unknown): void {
		const event: SystemEvent<EventType> = {
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
			let result = processEvent.call(this, event);
			result.rescue(console.error);
			this.#controller.emit('event', event, result);
		}

		this.#controller.emit('settled');

		function processEvent(this: SystemManager, event: SystemEvent): Result<unknown> {
			let result: Result<unknown>|undefined;
			const controller: SystemDispatchController = {
				set(result: Result<unknown>) {
					result = result;
				},
				handled(data?: unknown) {
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
