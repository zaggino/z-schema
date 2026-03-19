# z-schema

Fast, lightweight JSON Schema validator for Node.js and browsers with **full support for the latest JSON Schema draft (2020-12)**, plus draft-2019-09, draft-07, draft-06, and draft-04.

[![NPM](https://nodei.co/npm/z-schema.png?downloads=true&downloadRank=true)](https://www.npmjs.com/package/z-schema)

[![Coverage 91%](https://img.shields.io/badge/coverage-91%25-brightgreen)](docs/test-coverage.md)

## Install

```bash
npm install z-schema
```

Requires **Node.js 22** or later.

## Quick Start

### ESM / TypeScript

```typescript
import ZSchema from 'z-schema';

const validator = ZSchema.create();

try {
  validator.validate({ name: 'Alice' }, { type: 'object', properties: { name: { type: 'string' } } });
  console.log('Valid');
} catch (error) {
  console.log('Invalid:', error.details);
}
```

### CommonJS

```javascript
const ZSchema = require('z-schema');
const validator = ZSchema.create();
```

### Browser (UMD)

```html
<script src="z-schema/umd/ZSchema.min.js"></script>
<script>
  const validator = ZSchema.create();
  try {
    validator.validate('hello', { type: 'string' });
  } catch (error) {
    console.log(error.details);
  }
</script>
```

### CLI

```bash
npm install --global z-schema
z-schema mySchema.json
z-schema mySchema.json myData.json
z-schema --strictMode mySchema.json myData.json
```

## Usage

`ZSchema.create()` returns one of four validator variants based on the `async` and `safe` options:

| Options                       | Class              | `validate()` returns       |
| ----------------------------- | ------------------ | -------------------------- |
| `{}`                          | `ZSchema`          | `true` (throws on error)   |
| `{ safe: true }`              | `ZSchemaSafe`      | `{ valid, err? }`          |
| `{ async: true }`             | `ZSchemaAsync`     | `Promise<true>` (rejects)  |
| `{ async: true, safe: true }` | `ZSchemaAsyncSafe` | `Promise<{ valid, err? }>` |

### Sync Validation (Throw Mode)

By default, `validate` throws a `ValidateError` on failure. The error has a `details` array with structured error info.

```typescript
const validator = ZSchema.create(); // returns ZSchema

try {
  validator.validate(json, schema); // returns true
} catch (error) {
  console.log(error.name); // 'z-schema validation error'
  console.log(error.message); // summary message
  console.log(error.details); // array of { code, message, path, ... }
}
```

### Sync Validation (Safe Mode)

Use `{ safe: true }` to get a `ZSchemaSafe` instance whose `validate()` returns a result object instead of throwing.

```typescript
const validator = ZSchema.create({ safe: true }); // returns ZSchemaSafe

const result = validator.validate(json, schema); // { valid: boolean, err?: ValidateError }
if (!result.valid) {
  console.log(result.err!.details);
}
```

### Async Validation (Throw Mode)

Pass `{ async: true }` to support async format validators. Returns a `ZSchemaAsync` instance whose `validate()` returns a `Promise`.

```typescript
const validator = ZSchema.create({ async: true }); // returns ZSchemaAsync

try {
  await validator.validate(json, schema); // Promise<true>
} catch (error) {
  console.log(error.details);
}
```

### Async Validation (Safe Mode)

Combine both options to get a `ZSchemaAsyncSafe` instance — the promise always resolves (never rejects) with a result object.

```typescript
const validator = ZSchema.create({ async: true, safe: true }); // returns ZSchemaAsyncSafe

const result = await validator.validate(json, schema); // Promise<{ valid, err? }>
if (!result.valid) {
  console.log(result.err!.details);
}
```

### Schema Compilation

Pre-compile schemas at startup to validate `$ref` references and cache compiled schemas.

```typescript
const validator = ZSchema.create();

const schemas = [
  { id: 'person', type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  { id: 'team', type: 'object', properties: { lead: { $ref: 'person' } } },
];

try {
  validator.validateSchema(schemas);
} catch (error) {
  console.log('Schema errors:', error.details);
}
```

### Custom Format Validators

Register custom format validators for sync or async checks.

```typescript
const validator = ZSchema.create();

// Sync format
validator.registerFormat('uppercase', (value: unknown): boolean => {
  return typeof value === 'string' && value === value.toUpperCase();
});

// Async format
validator.registerFormat('user-exists', async (value: unknown): Promise<boolean> => {
  if (typeof value !== 'number') return false;
  const user = await db.getUserById(value);
  return user != null;
});
```

### Remote References

If your schemas reference remote URIs, register them before validation.

```typescript
const validator = ZSchema.create();

// Register a remote schema manually
validator.setRemoteReference('http://example.com/person.json', personSchema);

// Or set a schema reader to load them automatically
ZSchema.setSchemaReader((uri: string) => {
  const filePath = path.resolve(__dirname, 'schemas', uri + '.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
});
```

## Version History

| Version | Changes                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------- |
| **v12** | Default version is **draft2020-12**. Full support for **draft-2020-12** and **draft-2019-09**.    |
| **v11** | Default version is **draft-07**. Implemented draft-07 tests from JSON Schema Test Suite.          |
| **v10** | Default version is **draft-06**. Implemented draft-06 tests from JSON Schema Test Suite.          |
| **v9**  | New factory API: `ZSchema.create()` replaces `new ZSchema()`. New cache algorithms.               |
| **v8**  | Schemas without `$schema` default to draft-04. Use `{ version: 'none' }` for the old v7 behavior. |
| **v7**  | Rewritten in TypeScript/ESM. Passes all JSON Schema Test Suite tests for draft-04.                |
| **v6**  | Legacy version. Draft-04 support.                                                                 |

## Features

See [docs/features.md](docs/features.md) for the full feature list.

## Options

See [docs/options.md](docs/options.md) for all constructor and per-call options.

## Documentation

| Document                                     | Description                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| [docs/usage.md](docs/usage.md)               | Detailed usage guide with all validation modes, error handling, and advanced features |
| [docs/options.md](docs/options.md)           | Constructor options and per-call validation options                                   |
| [docs/features.md](docs/features.md)         | Feature catalog with examples                                                         |
| [docs/MIGRATION.md](docs/MIGRATION.md)       | Migration guide for upgrading between major versions                                  |
| [docs/architecture.md](docs/architecture.md) | Internal architecture, module structure, and public API reference                     |
| [docs/conventions.md](docs/conventions.md)   | Code style, naming, and formatting conventions                                        |
| [docs/testing.md](docs/testing.md)           | Test framework, running tests, and writing new tests                                  |
| [docs/contributing.md](docs/contributing.md) | PR workflow and contribution guidelines                                               |

## Contributing

This repository uses submodules. Clone with:

```bash
git clone --recursive https://github.com/zaggino/z-schema.git
```

See [docs/contributing.md](docs/contributing.md) for the full contribution guide.

## Contributors

Big thanks to:

<!-- readme: contributors,zaggino/- -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/sergey-shandar">
                    <img src="https://avatars.githubusercontent.com/u/902339?v=4" width="100;" alt="sergey-shandar"/>
                    <br />
                    <sub><b>Sergey Shandar</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/IvanGoncharov">
                    <img src="https://avatars.githubusercontent.com/u/8336157?v=4" width="100;" alt="IvanGoncharov"/>
                    <br />
                    <sub><b>Ivan Goncharov</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/pgonzal">
                    <img src="https://avatars.githubusercontent.com/u/47177787?v=4" width="100;" alt="pgonzal"/>
                    <br />
                    <sub><b>Pete Gonzalez (OLD ALIAS)</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/simon-p-r">
                    <img src="https://avatars.githubusercontent.com/u/4668724?v=4" width="100;" alt="simon-p-r"/>
                    <br />
                    <sub><b>Simon R</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/TheToolbox">
                    <img src="https://avatars.githubusercontent.com/u/2837017?v=4" width="100;" alt="TheToolbox"/>
                    <br />
                    <sub><b>Jason Oettinger</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/whitlockjc">
                    <img src="https://avatars.githubusercontent.com/u/98899?v=4" width="100;" alt="whitlockjc"/>
                    <br />
                    <sub><b>Jeremy Whitlock</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/toofishes">
                    <img src="https://avatars.githubusercontent.com/u/265817?v=4" width="100;" alt="toofishes"/>
                    <br />
                    <sub><b>Dan McGee</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/epoberezkin">
                    <img src="https://avatars.githubusercontent.com/u/2769109?v=4" width="100;" alt="epoberezkin"/>
                    <br />
                    <sub><b>Evgeny</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/antialias">
                    <img src="https://avatars.githubusercontent.com/u/447517?v=4" width="100;" alt="antialias"/>
                    <br />
                    <sub><b>Thomas Hallock</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/kallaspriit">
                    <img src="https://avatars.githubusercontent.com/u/277993?v=4" width="100;" alt="kallaspriit"/>
                    <br />
                    <sub><b>Priit Kallas</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/santam85">
                    <img src="https://avatars.githubusercontent.com/u/2706307?v=4" width="100;" alt="santam85"/>
                    <br />
                    <sub><b>Marco Santarelli</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Hirse">
                    <img src="https://avatars.githubusercontent.com/u/2564094?v=4" width="100;" alt="Hirse"/>
                    <br />
                    <sub><b>Jan Pilzer</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/geraintluff">
                    <img src="https://avatars.githubusercontent.com/u/1957191?v=4" width="100;" alt="geraintluff"/>
                    <br />
                    <sub><b>Geraint</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/lirenhe">
                    <img src="https://avatars.githubusercontent.com/u/9100546?v=4" width="100;" alt="lirenhe"/>
                    <br />
                    <sub><b>Renhe Li</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/dgerber">
                    <img src="https://avatars.githubusercontent.com/u/393344?v=4" width="100;" alt="dgerber"/>
                    <br />
                    <sub><b>Daniel Gerber</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/addaleax">
                    <img src="https://avatars.githubusercontent.com/u/899444?v=4" width="100;" alt="addaleax"/>
                    <br />
                    <sub><b>Anna Henningsen</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/mctep">
                    <img src="https://avatars.githubusercontent.com/u/1949681?v=4" width="100;" alt="mctep"/>
                    <br />
                    <sub><b>Konstantin Vasilev</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/barrtender">
                    <img src="https://avatars.githubusercontent.com/u/3101221?v=4" width="100;" alt="barrtender"/>
                    <br />
                    <sub><b>barrtender</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/RomanHotsiy">
                    <img src="https://avatars.githubusercontent.com/u/3975738?v=4" width="100;" alt="RomanHotsiy"/>
                    <br />
                    <sub><b>Roman Hotsiy</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/sauvainr">
                    <img src="https://avatars.githubusercontent.com/u/1715747?v=4" width="100;" alt="sauvainr"/>
                    <br />
                    <sub><b>RenaudS</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/figadore">
                    <img src="https://avatars.githubusercontent.com/u/3253971?v=4" width="100;" alt="figadore"/>
                    <br />
                    <sub><b>Reese</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/MattiSG">
                    <img src="https://avatars.githubusercontent.com/u/222463?v=4" width="100;" alt="MattiSG"/>
                    <br />
                    <sub><b>Matti Schneider</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/sandersky">
                    <img src="https://avatars.githubusercontent.com/u/422902?v=4" width="100;" alt="sandersky"/>
                    <br />
                    <sub><b>Matthew Dahl</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/jfromaniello">
                    <img src="https://avatars.githubusercontent.com/u/178512?v=4" width="100;" alt="jfromaniello"/>
                    <br />
                    <sub><b>José F. Romaniello</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/KEIII">
                    <img src="https://avatars.githubusercontent.com/u/1167833?v=4" width="100;" alt="KEIII"/>
                    <br />
                    <sub><b>Ivan Kasenkov</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/HanOterLin">
                    <img src="https://avatars.githubusercontent.com/u/21137108?v=4" width="100;" alt="HanOterLin"/>
                    <br />
                    <sub><b>Tony Lin</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/domoritz">
                    <img src="https://avatars.githubusercontent.com/u/589034?v=4" width="100;" alt="domoritz"/>
                    <br />
                    <sub><b>Dominik Moritz</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Semigradsky">
                    <img src="https://avatars.githubusercontent.com/u/1198848?v=4" width="100;" alt="Semigradsky"/>
                    <br />
                    <sub><b>Dmitry Semigradsky</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/countcain">
                    <img src="https://avatars.githubusercontent.com/u/1751150?v=4" width="100;" alt="countcain"/>
                    <br />
                    <sub><b>Tao Huang</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/BuBuaBu">
                    <img src="https://avatars.githubusercontent.com/u/3825745?v=4" width="100;" alt="BuBuaBu"/>
                    <br />
                    <sub><b>BuBuaBu</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: contributors,zaggino/- -end -->

and to everyone submitting [issues](https://github.com/zaggino/z-schema/issues) on GitHub
