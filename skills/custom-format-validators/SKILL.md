---
name: custom-format-validators
description: Registers and manages custom format validators in z-schema. Use when the user needs to add custom format validation, create sync or async format validators, register formats globally or per instance, validate emails or dates or phone numbers or custom business rules with format, configure formatAssertions for vocabulary-aware behavior, use customFormats option, list registered formats, handle async format timeouts, or understand how format validation differs across JSON Schema drafts.
---

# Custom Format Validators in z-schema

JSON Schema `format` constrains string (or other) values beyond basic type checking. z-schema includes built-in validators and supports registering custom ones — both sync and async.

## Built-in formats

z-schema ships with validators for all standard JSON Schema formats:

| Format                  | Validates                                   |
| ----------------------- | ------------------------------------------- |
| `date`                  | RFC 3339 full-date (`2024-01-15`)           |
| `date-time`             | RFC 3339 date-time (`2024-01-15T09:30:00Z`) |
| `time`                  | RFC 3339 time (`09:30:00Z`)                 |
| `email`                 | RFC 5321 email address                      |
| `idn-email`             | Internationalized email                     |
| `hostname`              | RFC 1123 hostname                           |
| `idn-hostname`          | Internationalized hostname                  |
| `ipv4`                  | IPv4 address                                |
| `ipv6`                  | IPv6 address                                |
| `uri`                   | RFC 3986 URI                                |
| `uri-reference`         | URI or relative reference                   |
| `uri-template`          | RFC 6570 URI template                       |
| `iri`                   | Internationalized URI                       |
| `iri-reference`         | Internationalized URI reference             |
| `json-pointer`          | RFC 6901 JSON Pointer                       |
| `relative-json-pointer` | Relative JSON Pointer                       |
| `regex`                 | ECMA-262 regex                              |
| `duration`              | ISO 8601 duration                           |
| `uuid`                  | RFC 4122 UUID                               |

## Registering a sync format

A format validator is a function `(input: unknown) => boolean`. Return `true` if valid, `false` if invalid. Return `true` for non-applicable types (e.g., when input is not a string) — z-schema calls format validators for any value type.

### Global registration (shared across all instances)

```typescript
import ZSchema from 'z-schema';

ZSchema.registerFormat('postal-code', (value) => {
  if (typeof value !== 'string') return true; // skip non-strings
  return /^\d{5}(-\d{4})?$/.test(value);
});
```

### Instance-scoped registration

```typescript
const validator = ZSchema.create();
validator.registerFormat('postal-code', (value) => {
  if (typeof value !== 'string') return true;
  return /^\d{5}(-\d{4})?$/.test(value);
});
```

Instance formats override global formats with the same name.

### Via options at creation time

```typescript
const validator = ZSchema.create({
  customFormats: {
    'postal-code': (value) => typeof value === 'string' && /^\d{5}(-\d{4})?$/.test(value),
    'always-valid': () => true,
    'disable-email': null, // disable the built-in email validator
  },
});
```

Pass `null` to disable a built-in or globally registered format.

## Registering an async format

Return `Promise<boolean>`. The validator must be created with `{ async: true }`.

```typescript
const validator = ZSchema.create({ async: true });

validator.registerFormat('user-exists', async (value) => {
  if (typeof value !== 'number') return true;
  const user = await db.findUser(value);
  return user != null;
});

// Validate (returns Promise)
try {
  await validator.validate(data, schema);
} catch (err) {
  console.log(err.details);
}
```

### Timeout

Async format validators time out after `asyncTimeout` milliseconds (default: 2000). Increase for slow operations:

```typescript
const validator = ZSchema.create({
  async: true,
  asyncTimeout: 10000, // 10 seconds
});
```

Timed-out validators produce an `ASYNC_TIMEOUT` error.

## Format assertion behavior across drafts

The JSON Schema spec changed how `format` works in newer drafts:

| Draft          | Default behavior                   | With `formatAssertions: true`             |
| -------------- | ---------------------------------- | ----------------------------------------- |
| draft-04/06/07 | Always asserts (fails on mismatch) | Always asserts                            |
| draft-2019-09  | Always asserts (z-schema default)  | Annotation-only unless vocabulary enabled |
| draft-2020-12  | Always asserts (z-schema default)  | Annotation-only unless vocabulary enabled |

z-schema defaults to `formatAssertions: null` (legacy — always assert). To respect the spec's vocabulary-aware behavior for modern drafts:

```typescript
const validator = ZSchema.create({ formatAssertions: true });
```

To disable all format assertions (annotation-only):

```typescript
const validator = ZSchema.create({ formatAssertions: false });
```

## Unknown formats

By default, z-schema reports `UNKNOWN_FORMAT` for unrecognized format names in draft-04/06/07. Modern drafts (2019-09, 2020-12) always silently ignore unknown formats.

To suppress unknown format errors in older drafts:

```typescript
const validator = ZSchema.create({ ignoreUnknownFormats: true });
```

## Unregistering a format

```typescript
// Global
ZSchema.unregisterFormat('postal-code');

// Instance
validator.unregisterFormat('postal-code');
```

## Listing formats

```typescript
// List globally registered custom formats
const customFormats = ZSchema.getRegisteredFormats();

// List all supported formats (built-in + custom) on an instance
const allFormats = validator.getSupportedFormats();

// Check if a specific format is supported
const supported = validator.isFormatSupported('postal-code');
```

## Real-world patterns

### Phone number validation

```typescript
ZSchema.registerFormat('phone', (value) => {
  if (typeof value !== 'string') return true;
  return /^\+?[1-9]\d{1,14}$/.test(value); // E.164 format
});
```

### ISO 8601 date (strict)

```typescript
ZSchema.registerFormat('iso-date', (value) => {
  if (typeof value !== 'string') return true;
  const d = new Date(value);
  return !isNaN(d.getTime()) && value === d.toISOString().split('T')[0];
});
```

### Business rule: value from external list

```typescript
const validator = ZSchema.create({ async: true });

validator.registerFormat('valid-country', async (value) => {
  if (typeof value !== 'string') return true;
  const countries = await fetchValidCountries();
  return countries.includes(value.toUpperCase());
});
```

### Side-effect: prefill defaults

Format validators can mutate objects (use with caution):

```typescript
ZSchema.registerFormat('fill-defaults', (obj) => {
  if (typeof obj === 'object' && obj !== null) {
    (obj as Record<string, unknown>).createdAt ??= new Date().toISOString();
  }
  return true;
});
```

## Schema usage

```json
{
  "type": "object",
  "properties": {
    "phone": { "type": "string", "format": "phone" },
    "country": { "type": "string", "format": "valid-country" },
    "zipCode": { "type": "string", "format": "postal-code" }
  }
}
```
