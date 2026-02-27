# Keyword Mapping Across Drafts

Complete mapping of JSON Schema keywords that changed between drafts, with before/after examples.

## Table of contents

- [Draft-04 → Draft-06](#draft-04--draft-06)
- [Draft-06 → Draft-07](#draft-06--draft-07)
- [Draft-07 → Draft-2019-09](#draft-07--draft-2019-09)
- [Draft-2019-09 → Draft-2020-12](#draft-2019-09--draft-2020-12)
- [Full keyword availability matrix](#full-keyword-availability-matrix)

---

## Draft-04 → Draft-06

### `id` → `$id`

```json
// Draft-04
{ "id": "http://example.com/schema.json" }

// Draft-06
{ "$id": "http://example.com/schema.json" }
```

### `exclusiveMinimum` / `exclusiveMaximum` (boolean → number)

```json
// Draft-04
{ "minimum": 0, "exclusiveMinimum": true }

// Draft-06+
{ "exclusiveMinimum": 0 }
```

The boolean form is removed. The number form means "strictly greater than" / "strictly less than".

### New keywords in draft-06

| Keyword         | Purpose                                    |
| --------------- | ------------------------------------------ |
| `const`         | Exact value match                          |
| `contains`      | At least one array item matches schema     |
| `propertyNames` | Validate property name strings             |
| Boolean schemas | `true` (accept all) / `false` (reject all) |

## Draft-06 → Draft-07

### New keywords in draft-07

| Keyword                  | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `if` / `then` / `else`   | Conditional schema application                 |
| `readOnly` / `writeOnly` | Annotation for read/write intent               |
| `contentMediaType`       | Media type of string content                   |
| `contentEncoding`        | Encoding of string content (e.g., `base64`)    |
| `$comment`               | Schema author comments (ignored by validators) |

No keywords were renamed or removed.

## Draft-07 → Draft-2019-09

### `definitions` → `$defs`

```json
// Draft-07
{
  "definitions": { "name": { "type": "string" } },
  "properties": { "name": { "$ref": "#/definitions/name" } }
}

// Draft-2019-09
{
  "$defs": { "name": { "type": "string" } },
  "properties": { "name": { "$ref": "#/$defs/name" } }
}
```

`definitions` still works but `$defs` is the canonical keyword. Update `$ref` paths accordingly.

### `dependencies` → `dependentRequired` + `dependentSchemas`

The mixed `dependencies` keyword is split:

**String-array dependencies → `dependentRequired`:**

```json
// Draft-07
{ "dependencies": { "credit_card": ["billing_address"] } }

// Draft-2019-09
{ "dependentRequired": { "credit_card": ["billing_address"] } }
```

**Schema dependencies → `dependentSchemas`:**

```json
// Draft-07
{ "dependencies": { "credit_card": { "properties": { "cvv": { "type": "string" } } } } }

// Draft-2019-09
{ "dependentSchemas": { "credit_card": { "properties": { "cvv": { "type": "string" } } } } }
```

### New keywords in draft-2019-09

| Keyword                              | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| `$anchor`                            | Named anchor for `$ref` targeting                  |
| `$recursiveRef` / `$recursiveAnchor` | Dynamic recursive references                       |
| `$vocabulary`                        | Meta-schema vocabulary declarations                |
| `dependentRequired`                  | Property existence dependencies                    |
| `dependentSchemas`                   | Schema-based dependencies                          |
| `unevaluatedProperties`              | Reject properties not evaluated by any applicator  |
| `unevaluatedItems`                   | Reject array items not evaluated by any applicator |
| `minContains` / `maxContains`        | Constrain number of `contains` matches             |

## Draft-2019-09 → Draft-2020-12

### Array-form `items` → `prefixItems`

```json
// Draft-2019-09 (tuple validation)
{
  "items": [{ "type": "string" }, { "type": "number" }],
  "additionalItems": { "type": "boolean" }
}

// Draft-2020-12
{
  "prefixItems": [{ "type": "string" }, { "type": "number" }],
  "items": { "type": "boolean" }
}
```

- Array-form `items` → `prefixItems`
- `additionalItems` → `items` (when `prefixItems` is present)
- Single-schema `items` (no tuple) remains `items` in both drafts

### `$recursiveRef` / `$recursiveAnchor` → `$dynamicRef` / `$dynamicAnchor`

```json
// Draft-2019-09
{
  "$recursiveAnchor": true,
  "items": { "$recursiveRef": "#" }
}

// Draft-2020-12
{
  "$dynamicAnchor": "node",
  "items": { "$dynamicRef": "#node" }
}
```

`$dynamicRef`/`$dynamicAnchor` are more flexible — they support named anchors rather than only boolean root anchors.

---

## Full keyword availability matrix

| Keyword                            | Draft-04 | Draft-06 | Draft-07 | 2019-09 | 2020-12 |
| ---------------------------------- | -------- | -------- | -------- | ------- | ------- |
| `id`                               | Yes      | —        | —        | —       | —       |
| `$id`                              | —        | Yes      | Yes      | Yes     | Yes     |
| `$anchor`                          | —        | —        | —        | Yes     | Yes     |
| `definitions`                      | Yes      | Yes      | Yes      | Yes\*   | Yes\*   |
| `$defs`                            | —        | —        | —        | Yes     | Yes     |
| `const`                            | —        | Yes      | Yes      | Yes     | Yes     |
| `contains`                         | —        | Yes      | Yes      | Yes     | Yes     |
| `minContains`/`maxContains`        | —        | —        | —        | Yes     | Yes     |
| `propertyNames`                    | —        | Yes      | Yes      | Yes     | Yes     |
| `if`/`then`/`else`                 | —        | —        | Yes      | Yes     | Yes     |
| `dependentRequired`                | —        | —        | —        | Yes     | Yes     |
| `dependentSchemas`                 | —        | —        | —        | Yes     | Yes     |
| `unevaluatedProperties`            | —        | —        | —        | Yes     | Yes     |
| `unevaluatedItems`                 | —        | —        | —        | Yes     | Yes     |
| `prefixItems`                      | —        | —        | —        | —       | Yes     |
| `$dynamicRef`/`$dynamicAnchor`     | —        | —        | —        | —       | Yes     |
| `$recursiveRef`/`$recursiveAnchor` | —        | —        | —        | Yes     | —       |
| Boolean schemas                    | —        | Yes      | Yes      | Yes     | Yes     |

\*`definitions` still works but `$defs` is preferred.
