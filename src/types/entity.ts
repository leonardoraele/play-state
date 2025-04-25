export type BaseEntityData = Record<string, unknown>;

export interface Entity<EntityDataType extends BaseEntityData = BaseEntityData> {
	id: string;
	data: EntityDataType;
}

export interface SubEntityOf<ComponentsType extends Record<string, unknown>, TypeUnion extends string = ''> {
	id: string;
	data: {
		[key in keyof ComponentsType]: key extends TypeUnion ? ComponentsType[key]
			: TypeUnion extends '' ? ComponentsType[key]|undefined
			: undefined;
	};
}
