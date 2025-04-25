import { beginWorldDefinition } from './world-definition.js';

const wdef = beginWorldDefinition()
	.withParameters<{ seed: string }>()
	.withComponent({
		type: 'position',
		initialData: { x: 0, y: 0 },
	})
	.withEntity({
		data: { position: { x: 1, y: 2 } },
	});

const world = wdef.instantiate({ seed: 'test' });
world.signals.on('ready', () => console.log('✅ World is ready!'));
console.log('ℹ World has been instantiated.');
