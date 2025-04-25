import type { WorldDefinition } from '../world-definition.js';

export interface PlayStatePlugin<
	OldWorldType extends WorldDefinition,
	NewWorldType extends OldWorldType,
> {
	(definition: OldWorldType): NewWorldType;
}
