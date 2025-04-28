import type { WorldDefinition } from '../world-definition.js';

export interface PlayStatePlugin<
	ExtendedWorldDefinition extends WorldDefinition,
> {
	(definition: WorldDefinition): ExtendedWorldDefinition;
}
