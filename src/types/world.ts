export interface WorldSettings<ParamsType extends Record<string, unknown> = Record<string, unknown>> {
	readonly params: ParamsType;
}
