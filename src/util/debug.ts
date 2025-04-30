import PACKAGE from '#package.json';

const createDebug = await import('debug')
	.then(exports => exports.default)
	.catch(() => undefined);
const debug = createDebug?.(PACKAGE.name);
export const entities = debug?.extend('entities') ?? console.debug;
export const components = debug?.extend('components') ?? console.debug;
export const views = debug?.extend('views') ?? console.debug;
export const systems = debug?.extend('systems') ?? console.debug;
export const events = debug?.extend('events') ?? console.debug;
