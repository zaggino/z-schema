# Skill Structure Reference

Detailed guide for structuring z-schema skills. Read this when writing or reviewing a skill's SKILL.md and reference files.

## Table of contents

- [File layout](#file-layout)
- [Frontmatter schema](#frontmatter-schema)
- [Progressive disclosure](#progressive-disclosure)
- [Writing patterns](#writing-patterns)
- [z-schema code example conventions](#z-schema-code-example-conventions)
- [Complete skill example](#complete-skill-example)
- [Checklist](#checklist)

---

## File layout

```
skill-name/
├── SKILL.md              # Required — main instructions
└── references/           # Optional — detailed reference material
    ├── topic-a.md        # Loaded into context on demand
    ├── topic-b.md
    └── ...
```

- `SKILL.md` is the only required file. It contains the YAML frontmatter and markdown instructions.
- `references/` holds supplementary material that the skill points to but that doesn't need to be in context all the time.
- Don't add directories beyond `references/` unless the skill genuinely needs scripts or assets. Most z-schema skills are documentation-only.

## Frontmatter schema

Every SKILL.md starts with YAML frontmatter between `---` fences:

```yaml
---
name: skill-name
description: What this skill does and when to use it. Be specific and include trigger phrases.
metadata: # Optional
  author: contributor-name
  version: '1.0'
---
```

**Required fields:**

| Field         | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `name`        | Identifier for the skill. Use kebab-case (e.g., `validating-json-schema`). |
| `description` | Controls when the skill triggers. Include what it does AND when to use it. |

**Optional fields:**

| Field              | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `metadata.author`  | Who wrote or maintains the skill           |
| `metadata.version` | Skill version, usually matching z-schema's |

### Writing a good description

The description is the primary trigger mechanism. Claude sees it in its available skills list and decides whether to consult the skill based on this text alone.

**Rules of thumb:**

- Start with what the skill does (verb phrase)
- Follow with "Use when..." listing specific contexts
- Include z-schema concepts the skill covers (e.g., "custom formats", "draft-04 migration", "unevaluatedProperties")
- Include alternative phrasings users might use (e.g., "validate JSON" / "check JSON" / "verify schema")
- Err on the side of triggering too often rather than too rarely

**Anti-patterns:**

- Too vague: "Helps with z-schema" (triggers for everything, useful for nothing)
- Too narrow: "Validates arrays with prefixItems in draft-2020-12" (misses related queries)
- Missing trigger contexts: "Validates JSON" (no mention of when to actually use it)

## Progressive disclosure

Skills use a three-level loading system:

1. **Metadata** (name + description) — always in context (~50–100 words)
2. **SKILL.md body** — loaded when skill triggers (<500 lines ideal)
3. **Reference files** — loaded on demand (unlimited size)

This means:

- Keep the SKILL.md focused on the most common workflows and decisions
- Move large tables, exhaustive lists, and niche scenarios into reference files
- Include clear pointers from SKILL.md to reference files: "For the full error code list, see [references/error-codes.md](references/error-codes.md)"

**When to create a reference file:**

- Content exceeds ~50 lines and serves a subset of the skill's users
- Content is a lookup table (options, error codes, draft feature matrix)
- Content covers a niche topic the main skill only mentions briefly
- Content needs a table of contents (>150 lines)

## Writing patterns

### Imperative voice

Write instructions in imperative form:

```markdown
# Good

Create a validator with `ZSchema.create()`.
Pass the schema as the second argument to `validate()`.

# Bad

You should create a validator using `ZSchema.create()`.
The schema should be passed as the second argument.
```

### Explaining why

Instead of rigid rules, explain the reasoning:

```markdown
# Good

Use `ZSchema.create()` instead of `new ZSchema()` — the factory method
returns a correctly typed variant (sync/async, throwing/safe) based on
your options, and the constructor is not part of the public API.

# Bad

ALWAYS use `ZSchema.create()`. NEVER use `new ZSchema()`.
```

### Code examples

Include complete, runnable TypeScript snippets. Every code block should:

- Have a language tag (`typescript`, `json`, etc.)
- Use correct z-schema imports
- Specify the draft version if it matters
- Show both success and failure cases when relevant

````markdown
## Example: Validate with error handling

\```typescript
import ZSchema from 'z-schema';

const validator = ZSchema.create();

const schema = {
type: 'object',
properties: {
email: { type: 'string', format: 'email' },
},
required: ['email'],
};

// Success case
validator.validate({ email: 'user@example.com' }, schema); // returns true

// Failure case
const { valid, err } = validator.validateSafe({ email: 42 }, schema);
if (!valid) {
console.log(err?.details[0].code); // 'INVALID_TYPE'
console.log(err?.details[0].path); // '#/email'
}
\```
````

### Defining output formats

When the skill produces structured output, show the template:

````markdown
## Schema template

Use this structure for API validation schemas:

\```json
{
"$schema": "https://json-schema.org/draft/2020-12/schema",
"type": "object",
"properties": { ... },
"required": [ ... ],
"additionalProperties": false
}
\```
````

### Conditional sections

When a skill covers multiple drafts or modes, use clear headings:

```markdown
## Draft-specific: tuple validation

### Draft-2020-12 (default)

Use `prefixItems` for positional validation and `items` for remaining items.

### Draft-04 through draft-07

Use array-form `items` for positional validation and `additionalItems` for remaining items.
```

## z-schema code example conventions

All code examples in z-schema skills must follow these rules:

### Imports

```typescript
// Default import (most common)
import ZSchema from 'z-schema';

// Named import
import { ZSchema } from 'z-schema';

// Type-only imports
import type { JsonSchema, ZSchemaOptions, SchemaErrorDetail, ValidateResponse } from 'z-schema';

// Value import (for instanceof checks, etc.)
import { ValidateError } from 'z-schema';
```

### Validator creation

```typescript
// Always use the factory — NEVER new ZSchema()
const validator = ZSchema.create();

// With options
const validator = ZSchema.create({
  version: 'draft-07',
  breakOnFirstError: true,
});
```

### Validation patterns

```typescript
// Sync (throws) — default
try {
  validator.validate(data, schema);
} catch (err) {
  // err is ValidateError with .details: SchemaErrorDetail[]
}

// Safe (returns result)
const { valid, err } = validator.validateSafe(data, schema);

// Async (for async format validators)
const asyncValidator = ZSchema.create({ async: true });
await asyncValidator.validate(data, schema);
```

### Error inspection

```typescript
// Always use .details (not .errors)
const { valid, err } = validator.validateSafe(data, schema);
if (!valid && err) {
  for (const detail of err.details) {
    console.log(detail.code); // e.g., 'INVALID_TYPE'
    console.log(detail.message); // e.g., 'Expected type string but found type number'
    console.log(detail.path); // e.g., '#/email'
    console.log(detail.keyword); // e.g., 'type'
    // Nested errors from anyOf/oneOf/not
    if (detail.inner) {
      for (const sub of detail.inner) {
        console.log(sub.code, sub.path);
      }
    }
  }
}
```

### Schema compilation

```typescript
// Pre-compile for cross-references and performance
const schemas = [
  { id: 'address', type: 'object', properties: { city: { type: 'string' } } },
  { id: 'person', type: 'object', properties: { home: { $ref: 'address' } } },
];
validator.validateSchema(schemas);
validator.validate({ home: { city: 'Paris' } }, 'person');
```

### Format validators

```typescript
// Global registration
ZSchema.registerFormat('my-format', (value) => /^\d{4}-\d{2}$/.test(String(value)));

// Instance registration
validator.registerFormat('my-format', (value) => typeof value === 'string' && value.length > 0);

// Async (requires async validator)
const asyncValidator = ZSchema.create({ async: true });
asyncValidator.registerFormat('user-exists', async (value) => {
  const user = await db.findUser(value);
  return user != null;
});
```

## Complete skill example

Here's a minimal but complete skill for a hypothetical "schema migration" task:

````markdown
---
name: schema-migration
description: Migrate JSON Schemas between draft versions using z-schema. Use when the user wants to upgrade schemas from draft-04 to draft-2020-12, convert between draft formats, update deprecated keywords, or adapt schemas to newer JSON Schema features like prefixItems, $defs, or unevaluatedProperties.
metadata:
  author: zaggino
  version: '12.0'
---

# Migrating JSON Schemas between drafts

z-schema supports draft-04, draft-06, draft-07, draft-2019-09, and draft-2020-12.
This skill covers common migration paths and keyword changes.

## Quick reference: keyword changes by draft

| Old keyword (draft-04)     | New keyword (draft-2020-12)              | Introduced in |
| -------------------------- | ---------------------------------------- | ------------- |
| `id`                       | `$id`                                    | draft-06      |
| `definitions`              | `$defs`                                  | draft-2019-09 |
| array-form `items`         | `prefixItems`                            | draft-2020-12 |
| boolean `exclusiveMinimum` | numeric `exclusiveMinimum`               | draft-06      |
| `dependencies` (mixed)     | `dependentRequired` / `dependentSchemas` | draft-2019-09 |

## Migration workflow

1. Set the target version on the validator:
   ```typescript
   const validator = ZSchema.create({ version: 'draft2020-12' });
   ```
````

2. Run `validator.validateSchema(schema)` to identify incompatibilities.
3. Fix each reported error, using the keyword mapping above.
4. Re-validate until the schema passes.

For the full keyword mapping and edge cases, see
[references/keyword-mapping.md](references/keyword-mapping.md).

```

## Checklist

Before finalizing a skill, verify each item:

- [ ] **Frontmatter** has `name` and `description`
- [ ] **Description** includes both what the skill does and when to trigger it
- [ ] **SKILL.md** is under 500 lines
- [ ] **Code examples** use `ZSchema.create()`, never `new ZSchema()`
- [ ] **Code examples** use correct imports (`import ZSchema from 'z-schema'`, `import type` for types)
- [ ] **Error handling** uses `.details` (not `.errors`)
- [ ] **Draft version** is specified in examples where it matters (default is `draft2020-12`)
- [ ] **API names** match current exports from `src/index.ts`
- [ ] **Option names** match `ZSchemaOptions` in `src/z-schema-options.ts`
- [ ] **Error codes** match the `Errors` object in `src/errors.ts`
- [ ] **Reference files** have clear pointers from SKILL.md with context on when to read them
- [ ] **Reference files** over 150 lines have a table of contents
- [ ] **No duplication** of content already in `docs/` — point to it instead
- [ ] **Contributor-facing skills** follow codebase conventions (ESM, `.js` extensions, `import type`, test suffixes)
- [ ] **Test prompts** are realistic things a real user would say
```
