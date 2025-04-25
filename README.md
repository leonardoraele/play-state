This document describes a state management framework for games. It was written with JavaScript in mind, but the concepts should be adaptable to any programming language.

This system is based on the Entity-Component-System framework and on concepts from Event-Driven Architecture Design — particularly, on the idea that systems communicate asynchronously via events. It is also inspired on the architecture of the game Desktop Dungeons by QCF Design, which is explained in depth in the [Dynamic Event-Listeners in Desktop Dungeons at Roguelike Celebration 2018](https://www.youtube.com/watch?v=p48ArjJweSo) talk.

> ##### ℹ Entity-Component-Sytem Reference
> For reference on ECS, see the [Overwatch Gameplay Architecture and Netcode at GDC 2017](https://www.gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and) talk ([YouTube video](https://www.youtube.com/watch?v=W3aieHjyNvw)).

### Principles

- **Loose Coupling.**
- **Flexibility.**
- **Determinism.**
- **Transparency.**
- **Clear System Boundaries.**

## Concepts

- **World.** Is the top-most object of the whole system. It is the [Facade](https://en.wikipedia.org/wiki/Facade_pattern) of the system and probably the part that the client will interact the most. It contains the whole state of the game, as well as the instances of the systems that control the state, and exposes the necessary interface to interact with them. (it is similar to the *Store* from other state management systems; but it uses the name *World* as it's traditional for game state systems)
	- A World object is built from a **World Definition**.
- **World Definition.** A [Type Object](https://gameprogrammingpatterns.com/type-object.html) that contains all the information necessary to instantiate the world. From the World Definition, it is possible to instantiate the same type of World multiple times.
	- It stores **Entities** and **Systems**.
- **Entity.** Entities represent game objects — Everything that exist in the simulated world is an Entity: characters, objects, etc.
	- Entities have zero or more **Components**, but only up to one Component of each type.
	- Entities have no other data besides Components and an *Id*, and it has no behavior. (i.e. no methods)
- **Component.** Each component contains a subset of the data of an Entity. All the components in an Entity, together, compose the data representation of that Entity.
	- Components have no behavior (i.e. no methods), only data.
	- Each component has a *type*, which is a string that uniquely identifies the component type and the shape of its data.
- **System.** Systems (together with **Events**) are the heart of this framework. They determine how Entities in the game behave. Systems work by accessing and modifying the Component data of Entities that exist in the world whenever certain **Events** of interest are dispatched to the World.
	- By default, Systems are not activated proactively (e.g. updated every frame). This is different than the ECS pattern. Instead, most Systems only react when they receive Events of interest from the World. When they do, they usually query the World for Entitites of interest and change the data in their Components according to the Event they received.
	- However, some Systems should be designed to actively gather data from external sources (e.g. network messages, user input, or time passing). This data should be wrapped into Events and dispatched into the World so that other systems can handle them.

	  If no System is actively pushing Events into the World (this is the default), the World will remain unchanged until the client (you) manually dispatches an event into it. This is usually desired for turn-based games.

	  This library should offer built-in Systems that can be plugged in the World Definition to add common functionality. For example, a `ticker` system that repeatedly emits `update` events and provide frame data, or a `input` system that detects input and emits `device-input` events.
- **Event.** Events are messages that can be inserted into the World manually by the client (you), or emitted by the System themselves in response to things that happen. It represents things happening in the world, like the Player entering input, NPCs attempting to perform actions, etc.
	- When an Event is dispatched into the World, the framework navigates through each System in the World and calls its `handle` function. A System should inspect the Event and either handle it or ignore it. Handling usually means it will search the World for relevant Entities and modify their data accordingly.
	- Alternatively, Systems can also emit different Events in response, or *transform* Events they receive, modifying their data before the next System handles it. This is similar to handling streams.

## Data Structure

```graph-selector
World
    -->: EntityManager
        many -->: Entity
            many -->: Component
    -->: SystemManager
        many -->: System
            ..>: SystemEvent
    -->: ViewManager
        many --: ViewDefinition
```

## API Example

```ts
const MyWorld: World = createWorldDefinition()
	// Define parameters to be received at world creation
	.withParameters(parameters as JTDSchema<unknown>)
	// Add component definitions
	.withComponent(...definitions as ComponentDefinition[])
	.withComponents(definitions as ComponentDefinition[])
	// Defines singleton entities that should be added to every world instance
	// at initialization. Usually have an id that is known to systems.
	.withEntity(...newEntity as EntityCreationCommand[])
	.withEntities(newEntity as EntityCreationCommand[])
	// Defines an index
	.withIndex(definition as IndexDefinition)
	// Adds systems to the world definition
	.withSystem(...systems as System[])
	.withSystems(systems as System[])
	// Adds views to the world definition
	.withView(...definitions as ViewDefinition)
	.withViews(definitions as ViewDefinition[])
	// Installs a plugin, which contain a set of pre-configures entities
	// components, systems, indexes, etc.
	.use(ExamplePlugin as PluginDefinition);

interface ComponentDefinition<T = unknown> {
	/** Unique identifier of the component type. */
	type: string;
	/** Optional definition of the component's data. */
	schema?: JTDSchema<T>;
	/** If provided, this data will be cloned with the
	 * `globalThis.structuredClone` function for each new component
	 * of this type, and assigned to the new component's data. */
	initialData?: T;
}

interface EntityCreationCommand {
	/** Unique identifier of this entity instance. If not provided, one will be
	 * automatically generated and assigned to this entity. */
	id?: string;
	/** Initial components of this entity, and optional initial data. */
	components: ComponentCreationCommand[];
}

type ComponentCreationCommand = string | {
	type: string;
	data?: unknown;
};

interface Entity {
	id: string;
	data: Record</*componentType*/ string, unknown>;
}

interface IndexDefinition {
	/* The name of the index. It should be unique. */
	name: string;
	/** Determines the component types to which this index applies. */
	componentTypes: string[];
	/** Determines this index applies to the given some component data. The `data`
	 * argument is guaranteed to contain the components specified in the
	 * `componentTypes` property. */
	grouper(data: Record<string, unknown>): string;
}

/** A plugin is simply a function that receives the world and can call methods to
 * add stuff to it. // TODO There should be mechanisms to prevent naming conflicts
 * (e.g. component types, index types, system names, index names, etc.) */
interface PluginDefinition {
	(world: WorldDefinition): void;
}

interface ViewDefinition {
	/** Unique idenfitier of the view. */
	name: string;
	/** Aggregator function that builds the view data. */
	selector: (em: EntityManager) => unknown;
}

interface System {
	/** Unique identifier of the system. */
	name: string;
	/** Human-readable short description of the system,
	 * only used by debugging tools. */
	getDisplayName?(): string; // For debugging purposes
	/** Callback function called once during world instantiation. */
	init?(wd: WorldData, em: EntityManager): void|Promise<void>;
	/** Callback function called once after all systems have been initialized.
	 * Systems can use this callback to start sending events to each other before
	 * the initialization routine returns control to the client. */
	ready?(sm: SystemManager, em: EntityManager): void|Promise<void>;
	/** Callback function to handle events emitted by other systems. */
	handle(controller: SystemDispatchController): void|Promise<void>;
}

interface WorldData {
	/** Data argument provided by the client at world creation. */
	params: Record<string, unknown>;
}

interface SystemManager {
	#systems: System[];
	dispatchEvent(eventType: string, payload?: unknown): void;
}

interface EntityManager {
	#entityIndex: Map</*id:*/ string, Entity>;
	#entityGroups: EntityGroup[];
	#componentDefinitions: Map</*type:*/ string, ComponentDefinition>;
	#indexes: Map</*name:*/ string, IndexData>;
	addEntity(definition: EntityCreationCommand): Entity;
	deleteEntity(entityId: string): void;
	addComponent(entityId: string, type: string, data?: unknown): Entity;
	removeComponent(id: string): void;
	createIndex(definition: IndexDefinition): void;
	queryId(id: string): Entity|undefined;
	/** Search for all entities that have all of the specified components.
	 * // TODO Instead of an array of strings, could get a mongodb-like query
	 * object describing Set-based conditions to match against entitiy groups.
	 * Example: The following query gets entitites that have a 'position'
	 * component, and either have the combination of 'HP' and 'AC' components,
	 * or have the 'dexterity-saving-throw' component.
	 * `{ $has: ['position'] $or: [{ $has: ['HP', 'AC'] }, { $has: ['dexterity-saving-throw'] }] }`
	 */
	queryTypes(...componentTypes: string[]): Entity[];
	/** Gets all the elements that have been grouped into the given key of the
	 * specified index. */
	queryIndex(indexName: string, key: string): Set<Entity>;
}

interface EntityGroup {
	/** A set of component types that describe the combination of components
	 * that entities in this group have. */
	componenTypes: Set<string>;
	/** A list of entities, all with the same combination of component types. */
	entities: Entity[]; // TODO Benchmark with Set<Entity> instead of array
}

interface IndexData extends IndexDefinition {
	entities: Map<string, Set<Entity>>;
}

interface SystemDispatchController {
	/** The event being handled by this controller. */
	event: SystemEvent;
	/** The world's EntityManager instance. The system can use it to query
	 * existing entity data. */
	entities: EntityManager;
	/** Signals that the event has been handled successfully, and optionally
	 * provide resulting data that can be read by the emitter system. */
	success(data?: unknown): void;
	/** Signals that the event has been handled, but the resulting activity
	 * has failed. Optionally provides an error object that describes the
	 * cause of the failure. */
	failure(error?: Error): void;
	/** Creates a new event with the same type as the event currently being
	 * handled, and signals that the new event should be dispatched to subsequent
	 * systems in the handle pipeline instead of the current event.*/
	transform(payload: JSONValue): void;
	/** Dispatch a new event, but the resolution of the new event is ignored. This
	 * means if success() or failure() is not called during the current event
	 * handling, subsequent systems in the pipeline will still be called after
	 * this handler returns control, though the new event is handled first.*/
	stack(eventType: string, payload: JSONValue): void;
	/** Dispatch a new event and signals that the current event is handled by the
	 * resolution of the new event. This means this event handles as success if
	 * the new event succeeds, and as failure if the new event fails. */
	replace(eventType: string, payload: JSONValue): void;
	/** Dispatch a new event, but queues it at the bottom of the current event,
	 * handling stack, so that it is only handled later. */
	queue(eventType: string, payload: JSONValue): void;
	/** Dispatch a new event and waits for its resolution. The returned promise
	 * resolves with the success data of the new event if it's handled
	 * successfully, or rejects with the error of the new event if it fails. */
	request<T>(eventType: string, payload: JSONValue): Promise<T>;
	/** Logs debug information to the system. */
	debug(...info: unknown): void;
}

interface SystemEvent {
	/** Unique identifier of this event instance. */
	id: string;
	/** Identifier of the type of event. This determines the shape of the event's
	 * payload. */
	type: string;
	/** Moment in time when the event was created. This is a milisecond-based
	 * Unix timestamp. */
	timestampMs: number;
	/** Event data. Set to `null` when there is no data to be transmitted. */
	payload: JSONValue;
	/** If this event was generated during the handling of another event, then
	 * this property points to that event. */
	parent?: SystemEvent;
}

//interface SystemEventResolution {
//	event: SystemEvent;
//	result: Result<unknown>;
// //	resolution: Resolution;
// //	success: Resolution extends 'success' ? true : false;
// //	failure: Resolution extends 'failure' ? true : false;
// //	result?: Resolution extends 'success' ? unknown : undefined;
// //	error?: Resolution extends 'failure' ? Error : undefined;
//}
```

```js
const instance = MyWorld.instantiate({ some: 'parameters' });

// Events dispatched before the world is ready will be queued and automatically
// delivered after the world becomes ready.
instance.dispatchEvent('eventType', { some: 'data' });

// The 'ready' event is emitted after all systems finish initializing.
instance.signals.on('ready', () => console.log('Listening to events.'));
instance.signals.on('event', e => console.log('Event received:', e));
instance.signals.on('settled', e => console.log('The event queue has been emptied.'));
instance.signals.on('event', e => e.type === 'update' && console.log('Update tick:', { now: e.payload.now, delta: e.payload.delta, fps: e.payload.fps }));
```

```ts
// A player client would send this event to the rules engine.
// A ClientCommandSystem would capture this event, interpret it, and
// dispatch a ThrowEvent.
interface UserCommand extends SystemEvent {
	type: 'command';
	payload: {
		action: 'throw';
		objectId: string;
		method?: string;
		targetPosition: WorldPosition;
	};
}

// A ThrowSystem would receive the ThrowEvent and update the game world
// accordingly.
interface ThrowEvent extends SystemEvent {
	type: 'throw';
	payload: {
		/** Who is throwing. */
		actorId: string;
		/** What is being thrown. **/
		subjectIds: string[];
		/** How is it being thrown.
		 * `launch` a deliberate throw to hit with precision; used to throw a spear
		 *   or a dart at a tareget.
		 * `hurl` a forceful throw; used to throw a rock or brick; a dart would
		 *   spin and miss the target.
		 * `lob` a soft, high-arc, precise throw; always lands in the intended
		 *   position.
		 * `toss` throw lightly, easily, or casually; don't go far; deal little
		 *   to no damage.
		 */
		method: 'throw'|'hurl'|'toss'|'drop'|'fling'|'lob';
		/** Where is it being thrown. */
		targetPosition: WorldPosition;
	};
}
```

## Future Features

- **Concurrent Event Handling.** If each System declares which components they read and which components they write, we can know which handlers can be called in parallel, thus optimizing event delivery routine.
