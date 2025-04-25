import { beginWorldDefinition, FrameUpdatePlugin } from './index.js';
import { SystemEvent } from './types/system.js';
import { WorldDefinition } from './world-definition.js';

const ExampleWorld = beginWorldDefinition()
	.withParameters<{
		seed: string,
	}>()
	.withComponent<{
		position: { x: number, y: number },
	}>()
	.withComponent<{
		velocity: { x: number, y: number },
	}>()
	.withEntity({
		data: {
			position: { x: 0, y: 0 },
			velocity: { x: 0, y: 0 },
		},
	})
	.withSystem(entityStore => {
		function isInputEvent(event: SystemEvent): event is SystemEvent<'input', { code: string, value: string }> {
			return event.type === 'input';
		}
		return {
			name: 'input-handler',
			ready(systems) {
				window.addEventListener('keydown', e => systems.dispatchEvent('input', { code: e.code, value: 'down' }));
				window.addEventListener('keydown', e => systems.dispatchEvent('input', { code: e.code, value: 'up' }));
			},
			handle(event) {
				if (!isInputEvent(event)) {
					return;
				}
				const entitites = entityStore.queryTypes(['velocity']).toArray();
				if (event.payload.value === 'down') {
					switch (event.payload.code) {
						case 'ArrowRight':
							entitites.forEach(entity => entity.data.velocity = { x: 1, y: 0 });
							break;
						case 'ArrowDown':
							entitites.forEach(entity => entity.data.velocity = { x: 0, y: 1 });
							break;
						case 'ArrowLeft':
							entitites.forEach(entity => entity.data.velocity = { x: -1, y: 0 });
							break;
						case 'ArrowUp':
							entitites.forEach(entity => entity.data.velocity = { x: 0, y: -1 });
							break;
						default:
							return;
					}
				}
				if (event.payload.value === 'up') {
					entitites.forEach(entity => entity.data.velocity = { x: 0, y: 0 });
				}
			},
		};
	})
	.use(FrameUpdatePlugin) // This plugin emits the 'update' event every frame (this is not a default in `play-state`)
	.withSystem(entityStore => {
		return {
			name: 'movement-handler',
			handle(event) {
				if (event.type !== 'update'
					|| typeof event.payload !== 'object'
					|| event.payload === null
					|| !('delta' in event.payload)
					|| typeof event.payload.delta !== 'number'
				) {
					return;
				}
				const entitites = entityStore.queryTypes(['position', 'velocity']).toArray();
				const PIXELS_PER_SECOND = 50;
				for (const entity of entitites) {
					entity.data.position.x += entity.data.velocity.x * PIXELS_PER_SECOND * event.payload.delta;
					entity.data.position.y += entity.data.velocity.y * PIXELS_PER_SECOND * event.payload.delta;
				}
			},
		};
	})
	.withView({
		name: 'hero-position',
		selector(entitites) {
			return entitites.queryTypes(['position']).first();
		},
	});

const world = ExampleWorld.instantiate({ seed: 'example' });

world.views.subscribe('hero-position', hero => {
	if (hero) {
		console.log("The hero's position changed:", hero.data.position);
	} else {
		console.log('The hero vanished :(');
	}
});
