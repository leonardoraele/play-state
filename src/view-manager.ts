import { ExtraIterator } from 'extra-iterator';
import type { EntityManager } from './entity-manager.ts';
import type { View } from './types/view.ts';
import type { WorldSettings } from './types/world.ts';
import { Computed, Effect } from '@leonardoraele/signals';
import { views as debug } from './util/debug.js';

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
	#computed: Record<string, Computed<any>> = {};
	#effects = new Map<ViewListener, Effect>();

	get<NameType extends keyof ViewsType>(name: NameType): ViewsType[NameType] {
		return this.#getOrInitComputed(name).value;
	}

	#getOrInitComputed<NameType extends keyof ViewsType>(name: NameType): Computed<ViewsType[NameType]> {
		return this.#computed[name as string] ??= new Computed(() => {
			debug('view-computed', 'Computing view...', { viewName: name });
			return this.#views[name as string]!.selector(this.entities, this.settings);
		});
	}

	subscribe<NameType extends keyof ViewsType>(name: NameType, callback: ViewListener<ViewsType[NameType]>): void;
	subscribe<NameType extends keyof ViewsType>(name: NameType, options: ViewSubscribeOptions, callback: ViewListener<ViewsType[NameType]>): void;
	subscribe(name: string, ...args: any): void {
		const [options, callback]: [ViewSubscribeOptions|undefined, ViewListener]
			= typeof args[0] === 'function' ? [undefined, args[0]] : args;
		const computed = this.#getOrInitComputed(name);
		const effect = new Effect(() => {
			const { value } = computed;
			debug('callback', 'Calling a callback...', { viewName: name });
			callback(value);
		}, { lazy: options?.lazy });
		this.#effects.set(callback, effect);
		options?.signal?.addEventListener('abort', () => this.unsubscribe(callback));
	}

	unsubscribe(callback: ViewListener): void {
		this.#effects.get(callback)?.dispose();
		this.#effects.delete(callback);
	}

	emitUpdates() {
		debug('emit-updates', 'Reevaluating dirty effects...');
		for (const effect of this.#effects.values()) {
			try {
				effect.reevaluate();
			} catch (cause) {
				console.error(cause);
			}
		}
	}
}

export type ReadonlyViewManager<
	ParamsType extends Record<string, unknown> = Record<string, unknown>,
	ComponentsType extends Record<string, unknown> = Record<string, unknown>,
	ViewsType extends Record<string, unknown> = Record<string, unknown>,
> = Pick<ViewManager<ParamsType, ComponentsType, ViewsType>, 'get'|'subscribe'>;
