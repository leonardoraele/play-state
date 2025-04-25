# Play State

> ### ⚠ Play State is still in early development. It is missing a lot of features, it has no tests yet, and no debugging tools. It is not ready for use. Please check on it again later.

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
- **Views.** Views are aggregations of state represented in well structured, JSON-like, format that is easy for external
	systems to parse.
	- Views allow external code to read the state of the World in a structured way, without having to
	query entities and interpret components.
	- They also serve as an interface from which external systems read the world,
	which decouples those systems from the actual underlying representation of the data. i.e. You can change the
	structure of your components and entitites, and external systems will still work as long as you update the views
	accordingly.
	- Views are automatically updated by the framework when relevant component data changes, and they emit events that
	external systems can listen to.

## Example

```ts
import { createWorldDefinition, FrameUpdatePlugin } from 'play-state';

const ExampleWorld = createWorldDefinition()
	.withComponent<{
		position: { x: number, y: number },
	}>()
	.withComponent<{
		velocity: { x: number, y: number },
	}>();
	.withEntity({
		data: {
			position: { x: 0, y: 0 },
			velocity: { x: 0, y: 0 },
		},
	})
	.withSystem({
		ready(systems: SystemManager) {
			window.addEventListener('keydown', e => {
				systems.emit('user-input', { code: e.code, value: 'down' });
			});
			window.addEventListener('keydown', e => {
				systems.emit('user-input', { code: e.code, value: 'up' });
			});
		},
		handle(event, controller) {
			if (event.type !== 'user-input') {
				return;
			}
			const entitites = controller.entitites.queryTypes(['velocity']);
			if (event.payload.value === 'down') {
				switch (event.payload.code) {
					case 'ArrowRight':
						entitites.forEach(entity => entity.velocity = { x: 1, y: 0 });
						break;
					case 'ArrowDown':
						entitites.forEach(entity => entity.velocity = { x: 0, y: 1 });
						break;
					case 'ArrowLeft':
						entitites.forEach(entity => entity.velocity = { x: -1, y: 0 });
						break;
					case 'ArrowUp':
						entitites.forEach(entity => entity.velocity = { x: 0, y: -1 });
						break;
					default:
						return;
				}
			}
			if (event.payload.value === 'up') {
				entitites.forEach(entity => entity.velocity = { x: 0, y: 0 });
			}
			controller.handled();
		}
	})
	.use(FrameUpdatePlugin) // This plugin emits the 'update' event every frame (this is not a default in `play-state`)
	.withSystem({
		handle(event, controller) {
			if (event.type !== 'update') {
				return
			}
			const entitites = controller.entitites.queryTypes(['position', 'velocity']);
			const PIXELS_PER_SECOND = 50;
			for (const entity of entitites) {
				entity.position.x += entity.velocity.x * PIXELS_PER_SECOND * event.payload.delta;
				entity.position.y += entity.velocity.y * PIXELS_PER_SECOND * event.payload.delta;
			}
			controller.handled();
		},
	})
	.withView({
		name: 'hero-position',
		selector(entitites: EntityManager): Entity|undefined {
			return entitites.queryTypes(['position'])[0];
		},
	});

const world = ExampleWorld.instantiate();

world.views.subscribe('hero-position', (hero: Entity|undefined) => {
	if (hero) {
		console.log("The hero's position changed:", hero.position);
	} else {
		console.log('The hero vanished :(');
	}
});
```

## Future Features

- **Concurrent Event Handling.** If each System declares which components they read and which components they write, we can know which handlers can be called in parallel, thus optimizing event delivery routine.
