import { Schema } from "effect";

export const Status = Schema.Struct({
  name: Schema.Literal("revisionist"),
  version: Schema.String,
  status: Schema.Literal("ok"),
});

export type Status = typeof Status.Type;

export const McpStatus = Schema.Struct({
  ...Status.fields,
  browserUrl: Schema.String,
});

export type McpStatus = typeof McpStatus.Type;
