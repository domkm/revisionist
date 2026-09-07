import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { Schema } from "effect";

/** Preserve validation and JSON Schema metadata on the same Effect schema. */
export function mcpSchema<S extends Schema.Constraint & Schema.ConstraintDecoder<unknown>>(
  schema: S,
) {
  const standard = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  }));
  return standard satisfies StandardSchemaWithJSON;
}
