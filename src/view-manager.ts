import { ExtraIterator } from 'extra-iterator';
import type { EntityManager } from './entity-manager.ts';
import type { View } from './types/view.ts';
import type { WorldSettings } from './types/world.ts';

interface ViewSubscribeOptions {
	signal?: AbortSignal;
	lazy?: boolean;
}

interface ViewListener<T = unknown> {
	(data: T): void;
}

export class ViewManager<
	ParamsType extends Record<string, unknown> = Record<string, unknown>,
	ComponentsType extends Record<string, unknown> = Record<string, unknown>,
	ViewsType extends Record<string, unknown> = Record<string, unknown>,
> {
	constructor(
		views: View<ParamsType, ComponentsType>[],
		private readonly entities: EntityManager<ComponentsType>,
		private readonly settings: WorldSettings<ParamsType>,
	) {
		this.#views = ExtraIterator.from(views)
			.map(view => [view.name, view])
			.collect(Object.fromEntries);
	}

	#views: Record<string, View<ParamsType, ComponentsType>> = {};
	#listeners: Record<string, ViewListener[]> = {};
	#cache: Record<string, unknown> = {};

	get<NameType extends keyof ViewsType>(name: NameType): ViewsType[NameType] {
		return this.#cache[name as string]
			= this.#views[name as string]!.selector(this.entities, this.settings) as ViewsType[NameType];
	}

	subscribe<NameType extends keyof ViewsType>(name: NameType, callback: ViewListener<ViewsType[NameType]>): void;
	subscribe<NameType extends keyof ViewsType>(name: NameType, options: ViewSubscribeOptions, callback: ViewListener<ViewsType[NameType]>): void;
	subscribe(name: string, ...args: any): void {
		const [options, callback]: [ViewSubscribeOptions|undefined, ViewListener]
			= typeof args[0] === 'function' ? [undefined, args[0]] : args;
		this.#listeners[name] ??= [];
		this.#listeners[name].push(callback);
		options?.signal?.addEventListener('abort', () => this.unsubscribe(name, callback));
		if (options?.lazy !== true) {
			callback(this.#cache[name] = this.#views[name]!.selector(this.entities, this.settings));
		}
	}

	unsubscribe(name: string, callback: ViewListener): void {
		this.#listeners[name] = (this.#listeners[name] ?? []).filter(listener => listener !== callback);
		if (this.#listeners[name].length === 0) {
			delete this.#listeners[name];
		}
	}

	update() {
		for (const name in this.#views) {
			try {
				const oldValue = this.#cache[name];
				const newValue = this.#cache[name] = this.#views[name]!.selector(this.entities, this.settings);
				if (oldValue !== newValue) {
					for (const listener of this.#listeners[name] ?? []) {
						try {
							listener(newValue);
						} catch (error) {
							console.error('An error ocurred during the execution of a view\'s listener.', 'View:', name, 'Error:', error);
						}
					}
				}
			} catch (error) {
				console.error('An error ocurred while processing a view. Error:', error);
			}
		}
	}
}

export type ReadonlyViewManager<
	ParamsType extends Record<string, unknown> = Record<string, unknown>,
	ComponentsType extends Record<string, unknown> = Record<string, unknown>,
	ViewsType extends Record<string, unknown> = Record<string, unknown>,
> = Pick<ViewManager<ParamsType, ComponentsType, ViewsType>, 'get'|'subscribe'|'unsubscribe'>;
