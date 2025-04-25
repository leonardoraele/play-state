export interface ComponentDefinition<TypeName extends string = string, Data = unknown> {
	type: TypeName;
	initialData?: Data;
}
