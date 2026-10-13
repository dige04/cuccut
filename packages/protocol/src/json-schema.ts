import { z } from 'zod';
import { refOf, type Localized, type MessageRef } from './message-ref.ts';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';

/**
 * JSON Schema for structured output (`responseFormat.schema` of `models.generateText`, architecture design §6.4). It is compiled once at submission, and an invalid schema is rejected at submission. The model's output is validated against it before it is returned. This is a separate subpath export, so the UI bundle does not include zod.
 *
 * Supports the parts that zod's `fromJSONSchema` recognizes (type, properties, required, additionalProperties, items, enum, const, anyOf/oneOf/allOf, length and range limits, pattern, format, local `$ref`). External `$ref` and unrecognized `type` values make the schema invalid. The root must be `type: 'object'`, because every provider's structured output is rooted in an object.
 */

/** The canonical JSON of a schema may be at most this long (bytes). */
export const MAX_JSON_SCHEMA_BYTES = 100_000;

export class JsonSchemaError extends Error {
  /** Message reference for the explanation, so it can be shown again in the reader's language. */
  readonly messageRef?: MessageRef;
  constructor(message: string | Localized) {
    super(String(message));
    this.name = 'JsonSchemaError';
    if (typeof message !== 'string') this.messageRef = refOf(message);
  }
}

export interface CompiledJsonSchema {
  /** Places that do not match (`path: explanation`), at most 20 entries; empty when valid. */
  validate(value: unknown): string[];
}

export function compileJsonSchema(schema: unknown): CompiledJsonSchema {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) throw new JsonSchemaError(V.jsonSchemaNotObject());
  if (new TextEncoder().encode(JSON.stringify(schema)).length > MAX_JSON_SCHEMA_BYTES) {
    throw new JsonSchemaError(V.jsonSchemaTooLarge({ max: MAX_JSON_SCHEMA_BYTES }));
  }
  if ((schema as { type?: unknown }).type !== 'object') throw new JsonSchemaError(V.jsonSchemaRootType());
  let compiled: z.ZodType;
  try {
    compiled = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]);
  } catch (error) {
    throw new JsonSchemaError(V.jsonSchemaInvalid({ error: error instanceof Error ? error.message : String(error) }));
  }
  return {
    validate(value) {
      const result = compiled.safeParse(value);
      if (result.success) return [];
      return result.error.issues
        .slice(0, 20)
        .map((issue) =>
          V.jsonSchemaIssue({ path: issue.path.length > 0 ? issue.path.join('.') : V.jsonSchemaRoot().text, message: issue.message }).text,
        );
    },
  };
}
