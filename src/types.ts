type BaseEntityData = Record<string, unknown>;

interface Entity<EntityDataType extends BaseEntityData = BaseEntityData> {
	id: string;
	data: EntityDataType;
}

interface ComponentDefinition<TypeName extends string = string, Data = unknown> {
	type: TypeName;
	initialData?: Data;
}

interface System {

}
