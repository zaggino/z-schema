# Changelog

## [12.3.0](https://github.com/zaggino/z-schema/compare/v12.2.0...v12.3.0) (2026-06-03)


### Features

* make package ESM-first via "type": "module" ([#409](https://github.com/zaggino/z-schema/issues/409)) ([28b26b8](https://github.com/zaggino/z-schema/commit/28b26b83a5beb247328200cfb93e0932edf63d76))


### Performance Improvements

* replace slower constructs with faster equivalents across hot paths ([#419](https://github.com/zaggino/z-schema/issues/419)) ([5f3eeef](https://github.com/zaggino/z-schema/commit/5f3eeef0e599def338cd6d695be2b66bc9fde823))

## [12.2.0](https://github.com/zaggino/z-schema/compare/v12.1.1...v12.2.0) (2026-04-27)


### Features

* **cli:** show JSON filename in output instead of "json #N" ([#400](https://github.com/zaggino/z-schema/issues/400)) ([0150595](https://github.com/zaggino/z-schema/commit/0150595ff92091707a7faf25dc1b35354af95530))


### Bug Fixes

* **deps:** bump vite to &gt;=7.3.2 to address GHSA-p9ff-h696-f583 ([#393](https://github.com/zaggino/z-schema/issues/393)) ([7fad0aa](https://github.com/zaggino/z-schema/commit/7fad0aa5ba89ffbfc55fdc25ce4ca6b1e537dd03))

## [12.1.1](https://github.com/zaggino/z-schema/compare/v12.1.0...v12.1.1) (2026-04-02)


### Bug Fixes

* allow consecutive hyphens in ASCII hostname labels per RFC 1123 ([#391](https://github.com/zaggino/z-schema/issues/391)) ([baae254](https://github.com/zaggino/z-schema/commit/baae254d1910803ef18807504eb0220bc6dba8e3))

## [12.1.0](https://github.com/zaggino/z-schema/compare/v12.0.5...v12.1.0) (2026-03-20)


### Features

* switch bundler from rollup to tsdown ([a9245fd](https://github.com/zaggino/z-schema/commit/a9245fd827155a0223f353105b7996166a5a0a48))

  WARNING: minor breaking change if you imported files from /dist folder directly, they now have correct .mjs extension instead of .js

## [12.0.5](https://github.com/zaggino/z-schema/compare/v12.0.4...v12.0.5) (2026-03-20)


### Bug Fixes

* add safe-regex2 ReDoS guard and strengthen prototype pollution protection ([09de63a](https://github.com/zaggino/z-schema/commit/09de63a3bce65c009a68871842318544e063859d))

## [12.0.4](https://github.com/zaggino/z-schema/compare/v12.0.3...v12.0.4) (2026-03-19)


### Bug Fixes

* correctly set sideEffects for file that needs it ([#381](https://github.com/zaggino/z-schema/issues/381)) ([29d05bb](https://github.com/zaggino/z-schema/commit/29d05bb65a137538624ce063b41105e1f61e78af))

## [12.0.3](https://github.com/zaggino/z-schema/compare/v12.0.2...v12.0.3) (2026-03-17)


### Bug Fixes

* update 'uri' and 'duration' format validators to comply with json-schema-test-suite ([0d85bf0](https://github.com/zaggino/z-schema/commit/0d85bf01024fd935ddf6c42259580287ad667a0e))

## [12.0.2](https://github.com/zaggino/z-schema/compare/v12.0.1...v12.0.2) (2026-03-04)


### Bug Fixes

* address CodeQL security alerts (CWE-1321, CWE-95, CWE-400) ([#374](https://github.com/zaggino/z-schema/issues/374)) ([a0b1272](https://github.com/zaggino/z-schema/commit/a0b12722408a8c9c5e93b5b5a9aa041419fdc778))

## [12.0.1](https://github.com/zaggino/z-schema/compare/v12.0.0...v12.0.1) (2026-03-03)


### Bug Fixes

* clamp asyncTimeout to prevent resource exhaustion (CWE-400) ([#370](https://github.com/zaggino/z-schema/issues/370)) ([ffd31ed](https://github.com/zaggino/z-schema/commit/ffd31ed10c558e3f9670f938ef002a58e7deea60))
* code scanning alert no. 15: Inefficient regular expression ([#368](https://github.com/zaggino/z-schema/issues/368)) ([4d54149](https://github.com/zaggino/z-schema/commit/4d541498c5494da63b10f84b6878c63e9bfebf5f))
* enforce max pattern length in compileSchemaRegex to mitigate regex injection (CWE-95) ([c6e1be4](https://github.com/zaggino/z-schema/commit/c6e1be428a4547bf1a47a7c1cb632cf37ee8d23b))
* js/path-injection alerts ([#372](https://github.com/zaggino/z-schema/issues/372)) ([6a3c774](https://github.com/zaggino/z-schema/commit/6a3c7748b10efd841a87c0bb19e74a409b991259))
* js/resource-exhaustion, CWE-400 ([2801b49](https://github.com/zaggino/z-schema/commit/2801b49b33fc17a9ef6c0ad568edfad627a52317))
* polynomial regular expression used on uncontrolled data ([#371](https://github.com/zaggino/z-schema/issues/371)) ([007cf85](https://github.com/zaggino/z-schema/commit/007cf857ceb9f3e72a8f1870d9a090b4b32b89a1))
* prevent prototype-polluting assignments in schema compiler (CWE-1321) ([f4f2735](https://github.com/zaggino/z-schema/commit/f4f273596341eb433863fd7081dc70f430156642))
* validate URLs before fetching remote schemas in CLI to prevent SSRF (CWE-918) ([75c161e](https://github.com/zaggino/z-schema/commit/75c161e137046efee9900c08c942bf1333b2052f))
* workflow permissions ([cd85523](https://github.com/zaggino/z-schema/commit/cd85523b161804b536b75ce73a9b4bf3ef575246))

## [12.0.0](https://github.com/zaggino/z-schema/compare/v11.0.1...v12.0.0) (2026-02-28)


### ⚠ BREAKING CHANGES

* **Default schema version changed from `draft-07` to `draft2020-12`.** If your schemas rely on draft-04/06/07 behavior, set `version` explicitly or declare `$schema` in every schema. See [MIGRATION.md](docs/MIGRATION.md#upgrading-to-v12) for details.
* **Format is annotation-only by default for draft-2019-09 / draft-2020-12.** In these drafts, unknown formats no longer produce errors (per the specification). Set `formatAssertions: null` to restore the legacy always-assert behavior.
* **New `maxRecursionDepth` safeguard (default: 100).** Deeply nested schemas or data that previously validated may now fail with `MAX_RECURSION_DEPTH_EXCEEDED`. Increase the value if needed.

### Features

* implement draft-2019-09 and draft-2020-12 support with `draft2020-12` as the new default version ([#355](https://github.com/zaggino/z-schema/pull/355)) ([c0c3a30](https://github.com/zaggino/z-schema/commit/c0c3a308c66cc17ece0ae69f6ed8615f869fe6ad))
  * **draft-2019-09**: `$anchor`, `$recursiveRef`/`$recursiveAnchor`, `$defs`, `$vocabulary`, `dependentRequired`, `dependentSchemas`, `maxContains`, `minContains`, `unevaluatedItems`, `unevaluatedProperties`
  * **draft-2020-12**: `$dynamicRef`/`$dynamicAnchor`, `prefixItems`, refined `items` (applies to remaining items after `prefixItems`)
  * Full annotation-based `unevaluatedProperties`/`unevaluatedItems` with applicator traversal through `allOf`, `anyOf`, `oneOf`, `if`/`then`/`else`, `dependentSchemas`, `contains`, `$ref`, `$recursiveRef`, `$dynamicRef`
* add `formatAssertions` option to control format assertion behavior per draft ([c0c3a30](https://github.com/zaggino/z-schema/commit/c0c3a308c66cc17ece0ae69f6ed8615f869fe6ad))
* implement maxRecursionDepth safeguard ([d3a2e4f](https://github.com/zaggino/z-schema/commit/d3a2e4f008fa9497e875af4adc4b8608f2cc9a5a))
* new TypeScript types: `JsonSchemaDraft201909`, `JsonSchemaDraft202012` with layered inheritance ([ba1bd69](https://github.com/zaggino/z-schema/commit/ba1bd69674294f0b8590a2031047286b53e0095b))
* new error codes: `ARRAY_UNEVALUATED_ITEMS`, `OBJECT_UNEVALUATED_PROPERTIES`, `COLLECT_EVALUATED_DEPTH_EXCEEDED`, `MAX_RECURSION_DEPTH_EXCEEDED`


### Bug Fixes

* **formats:** respect null overrides in isFormatSupported ([077cc34](https://github.com/zaggino/z-schema/commit/077cc34b2e33e8fdc425d3eb0ba8fee595555eed))
* make getId draft-aware to return `id` for draft-04 and `$id` for newer drafts ([c7ec640](https://github.com/zaggino/z-schema/commit/c7ec64092544f645ffa040c91df0d2c1ddcd7f94))
* fix "custome" typo in schema-validator comments ([d5d504b](https://github.com/zaggino/z-schema/commit/d5d504b203b67327407b12d166b4d79c72b7c9f9))


### Performance Improvements

* convert difference() to use Set for O(1) lookups ([da39595](https://github.com/zaggino/z-schema/commit/da3959582964a9a56a3216e5f55c29e7fbe91b80))
* **schema-cache:** cache global_cache clone in instance cache on first access ([21e2bca](https://github.com/zaggino/z-schema/commit/21e2bcae1f42cc4897ce08c73be67b91ba22cc5a))
* **utils:** optimize isUniqueArray with primitive fast path ([de94b36](https://github.com/zaggino/z-schema/commit/de94b36dea73371e8f428b0c40a427f7e7e21cde))


### Refactoring

* split json-validation.ts into validation/keyword modules (type, numeric, string, array, object, combinators, ref) ([121a5da](https://github.com/zaggino/z-schema/commit/121a5dafe1296e4bd26af4d882de87556fb6faef))
* populate draft-specific TypeScript interfaces with layered inheritance ([ba1bd69](https://github.com/zaggino/z-schema/commit/ba1bd69674294f0b8590a2031047286b53e0095b))
* replace `___$visited` schema mutation with WeakSet in getResolvedSchema ([161430c](https://github.com/zaggino/z-schema/commit/161430c1656ee7fababbf073fca80931ae5be153))
* add Report.addAsyncTaskWithPath to encapsulate async path save/restore ([dd64322](https://github.com/zaggino/z-schema/commit/dd643222f06e5e853b72c038e6e7d8726ff58b33))
* replace factory @ts-expect-error with module-private FACTORY_TOKEN symbol ([7364904](https://github.com/zaggino/z-schema/commit/73649047ffef3f56c767dceb7fb9e95985e69e34))
* modernize loop patterns, indexOf, hasOwn, and unicode handling ([e2a3edb](https://github.com/zaggino/z-schema/commit/e2a3edb1cc0adde65715402f412fbf0d8f7a9c69))
* deduplicate setRemoteReference, NON_SCHEMA_KEYWORDS, async task aggregation, and isInternalKey ([003c413](https://github.com/zaggino/z-schema/commit/003c4133360412262dc673e7da7743d09653a713))


### Tests

* migrate ZSchemaTestSuite legacy JS fixtures to TypeScript ([fc87835](https://github.com/zaggino/z-schema/commit/fc8783556aa44c813a2a84423fd3e230b6488c03))
* make error-ordering assertions order-independent ([8f19ee4](https://github.com/zaggino/z-schema/commit/8f19ee4040075eab0bb0bf6f6f908dc1f410aee2))

## [11.0.1](https://github.com/zaggino/z-schema/compare/v11.0.0...v11.0.1) (2026-02-25)


### Bug Fixes

* refresh docs ([4f6a30f](https://github.com/zaggino/z-schema/commit/4f6a30fc6ca54893043e6626cdca82ed337e898f))


## [11.0.0](https://github.com/zaggino/z-schema/compare/v10.0.0...v11.0.0) (2026-02-25)


### ⚠ BREAKING CHANGES

* implement draft-07, draft-07 version is the new default

### Features

* implement draft-07, draft-07 version is the new default ([c83f4bd](https://github.com/zaggino/z-schema/commit/c83f4bd9e05586dc6c6a5d933d93fd45ed408e42))


## [10.0.0](https://github.com/zaggino/z-schema/compare/v9.0.1...v10.0.0) (2026-02-24)


### ⚠ BREAKING CHANGES

* implement draft-06, draft-06 version is the new default

### Features

* implement draft-06, draft-06 version is the new default ([30c37ad](https://github.com/zaggino/z-schema/commit/30c37adf251a4e6dc1a52b0790a43c9b7fb6d3e8))


## [9.0.1](https://github.com/zaggino/z-schema/compare/v9.0.0...v9.0.1) (2026-02-09)


### Bug Fixes

* add optional schemaPath to errors to suggest which part of schema triggered the error, fixes [#198](https://github.com/zaggino/z-schema/issues/198) ([322aec9](https://github.com/zaggino/z-schema/commit/322aec9649056986cc131d777f1765eaa12a5c0c))
* better handle references in SchemaReader, fixes [#157](https://github.com/zaggino/z-schema/issues/157) ([77121cb](https://github.com/zaggino/z-schema/commit/77121cb527999c0a46af440ef982ba45a1cd88d8))
* cli issue, fixes [#184](https://github.com/zaggino/z-schema/issues/184) ([56cf942](https://github.com/zaggino/z-schema/commit/56cf94297734e0f5053f709e7d8cc676b75db384))
* improved handling of multipleOf, fixes [#69](https://github.com/zaggino/z-schema/issues/69) ([f2dde3a](https://github.com/zaggino/z-schema/commit/f2dde3a4d1bec4f3cc9f451dfa484491d8c2b629))
* incorrectly resolved against top-level document, fixes [#165](https://github.com/zaggino/z-schema/issues/165) ([35113e5](https://github.com/zaggino/z-schema/commit/35113e501ae9223f884ce3c7de0f41d492bea0a2))


## [9.0.0](https://github.com/zaggino/z-schema/compare/v8.5.0...v9.0.0) (2026-02-09)


### ⚠ BREAKING CHANGES

* **`new ZSchema()` replaced by `ZSchema.create()` factory.** The constructor is no longer the public API. Use `ZSchema.create(options)` to get a typed validator instance. ([#336](https://github.com/zaggino/z-schema/issues/336))
* **`validate()` now throws by default.** Returns `true` on success, throws `ValidateError` on failure. Use `{ safe: true }` for a non-throwing API that returns `{ valid, err? }`.
* **Four typed class variants.** `ZSchema.create()` returns `ZSchema`, `ZSchemaSafe`, `ZSchemaAsync`, or `ZSchemaAsyncSafe` based on `{ async, safe }` options.
* **`getLastError()` / `getLastErrors()` removed.** Errors are now returned directly from `validate()` — thrown as `ValidateError` (default) or in `{ err }` field (safe mode).
* **`isValid()`, `compileSchema()`, `getMissingReferences()`, `getMissingRemoteReferences()`, `getResolvedSchema()` removed.**
* **`setRemoteReference()` is now static only.** The instance method was removed; use `ZSchema.setRemoteReference()`.
* **`validateAsyncSafe()` return type changed.** Returns `{ valid, err? }` instead of `{ valid, errs? }`.
* **Schema caching refactored.** Internal `SchemaCache` algorithms changed; custom code relying on cache internals will break.

### Features

* new factory API with typed class variants ([#336](https://github.com/zaggino/z-schema/issues/336)) ([72bf15b](https://github.com/zaggino/z-schema/commit/72bf15bf16d93802129f363086be64747a68211f))
* extract `ZSchemaBase`, `ZSchemaOptions`, and `SchemaReader` into separate modules


## [8.5.0](https://github.com/zaggino/z-schema/compare/v8.4.0...v8.5.0) (2026-02-06)


### Features

* add promise api and document how to perform async validation in README ([4921400](https://github.com/zaggino/z-schema/commit/492140012b25db4812a18da1c0aefbfc7245dc0c))
* support async format validators returning Promise&lt;boolean&gt; ([dd5d99d](https://github.com/zaggino/z-schema/commit/dd5d99dd1cf63c1a1d293c03285dd5428425853f))


### Bug Fixes

* async format validator behavior in oneOf, fixes [#207](https://github.com/zaggino/z-schema/issues/207) ([2aac679](https://github.com/zaggino/z-schema/commit/2aac6793cd8db835454a74b7b71740aec44aa49a))


## [8.4.0](https://github.com/zaggino/z-schema/compare/v8.3.0...v8.4.0) (2026-02-05)


### Features

* add instance scoped format functions, fixes [#214](https://github.com/zaggino/z-schema/issues/214) ([ec4f5cb](https://github.com/zaggino/z-schema/commit/ec4f5cbe2b863c7fbd053ac69c85c2aba436522f))


### Bug Fixes

* report all errors from optional parent object, fixes [#224](https://github.com/zaggino/z-schema/issues/224) ([7b79332](https://github.com/zaggino/z-schema/commit/7b793326372921065d6c5babf195821eec38d52f))


## [8.3.0](https://github.com/zaggino/z-schema/compare/v8.2.0...v8.3.0) (2026-02-05)


### Features

* add keyword in error objects, fixes [#232](https://github.com/zaggino/z-schema/issues/232) ([b243a13](https://github.com/zaggino/z-schema/commit/b243a13823e6836e3e2f5aafd64b140ce39c6e21))


## [8.2.0](https://github.com/zaggino/z-schema/compare/v8.1.0...v8.2.0) (2026-02-05)


### Features

* added an option to exclude errors from being reported, fixes [#263](https://github.com/zaggino/z-schema/issues/263) ([417f7d7](https://github.com/zaggino/z-schema/commit/417f7d7889452d2291f8716d91c9d8baa550dbc9))


## [8.1.0](https://github.com/zaggino/z-schema/compare/v8.0.0...v8.1.0) (2026-02-05)


### Features

* export global format functions ([f8cc7cf](https://github.com/zaggino/z-schema/commit/f8cc7cf25c2beb5a829338108073f49ad05e3252))


## [8.0.0](https://github.com/zaggino/z-schema/compare/v7.2.0...v8.0.0) (2026-02-05)


### ⚠ BREAKING CHANGES

* **Schemas without `$schema` are now treated as draft-04.** Previously, schemas missing `$schema` were validated without strict draft semantics. Now `$schema` is automatically set to `http://json-schema.org/draft-04/schema#`. Use `{ version: 'none' }` to opt out. ([#325](https://github.com/zaggino/z-schema/issues/325))
* **New `version` option on `ZSchemaOptions`.** Defaults to `'draft-04'`. Set to `'none'` to disable automatic `$schema` injection.
* **Meta-schemas registered globally.** Draft-04 meta-schemas are now registered via `ZSchema.setRemoteReference()` at module load time instead of per-instance in the constructor.

### Features

* add `version` option to `ZSchemaOptions` for selecting the JSON Schema draft ([#325](https://github.com/zaggino/z-schema/issues/325)) ([15d2855](https://github.com/zaggino/z-schema/commit/15d285597d887e7d61b2134d44f6c6d73dcd9f05))
* add `getDefaultSchemaId()` method

### Bug Fixes

* fix typo in error message (`dependensices` → `dependencies`)


## [7.2.0](https://github.com/zaggino/z-schema/compare/v7.1.0...v7.2.0) (2026-02-04)


### Features

* improve global schema caching ([8d79501](https://github.com/zaggino/z-schema/commit/8d795019b420f022d9e4a31ecb075b061aaa2e87))


### Bug Fixes

* error in collectReferences where scope was not reset when traversing inside an element with id ([fa883f0](https://github.com/zaggino/z-schema/commit/fa883f09deaa58934fb2e71dd3d8921cc877d0be))
* improve reference resolution ([390aae0](https://github.com/zaggino/z-schema/commit/390aae036248572250983aba2de04164660ff577))
* improving handling of JavaScript property names ([e74c294](https://github.com/zaggino/z-schema/commit/e74c294fc8908ba1cd8c389c20432a49d914b211))
* improving reference resolution ([d692677](https://github.com/zaggino/z-schema/commit/d692677d6fb6217ed99f91d58c332b9f2f1d0094))
* improving remote reference resolution ([67f25e2](https://github.com/zaggino/z-schema/commit/67f25e2e51044cd19f8190db795e8b5e64f1c5d7))
* Only import validator functions we actually use ([3487951](https://github.com/zaggino/z-schema/commit/34879513d8c1348f0ece972f0cb3eb1146108c97))
* some issues running tests with new validator imports ([dddb367](https://github.com/zaggino/z-schema/commit/dddb36758b4b4355a285da083a06b66cb0094c64))


## [7.1.0](https://github.com/zaggino/z-schema/compare/v7.0.9...v7.1.0) (2026-02-03)


### Features

* support for unicode properties, fixes [#298](https://github.com/zaggino/z-schema/issues/298) ([b7906d7](https://github.com/zaggino/z-schema/commit/b7906d74a1ddedf51374976e5f0ccc7e5a6e5b49))


## [7.0.9](https://github.com/zaggino/z-schema/compare/v7.0.8...v7.0.9) (2026-02-03)


### Bug Fixes

* drop dependency on lodash.get, fixes [#303](https://github.com/zaggino/z-schema/issues/303) ([8700310](https://github.com/zaggino/z-schema/commit/8700310e044e81a0f4fb1d3c2bf5cf82aa89a9f8))


## [7.0.8](https://github.com/zaggino/z-schema/compare/v7.0.7...v7.0.8) (2026-02-02)


### Bug Fixes

* schema caching ([0886ec4](https://github.com/zaggino/z-schema/commit/0886ec4161d6d63c639460ff480ba5e45829a92e))
* validate type signatures ([1c85ef7](https://github.com/zaggino/z-schema/commit/1c85ef78a2b7594450838fb85db73da8099e1c0e))
* validateSchema type signatures ([f6a5617](https://github.com/zaggino/z-schema/commit/f6a5617685f60bdb69430088de83802cf1bdee80))


### Miscellaneous Chores

* release 7.0.8 ([0e0d991](https://github.com/zaggino/z-schema/commit/0e0d9918e12c2b3c168d9a37283642d288d17985))


## [7.0.7](https://github.com/zaggino/z-schema/compare/v7.0.6...v7.0.7) (2026-02-02)


### Bug Fixes

* limit exported typings ([a9c775e](https://github.com/zaggino/z-schema/commit/a9c775eb1e66897d3861f5725f94d834a925d897))
* validate input typings ([09c656a](https://github.com/zaggino/z-schema/commit/09c656a894e0dbb903cda6167aed3eb1f2b328c7))


### Miscellaneous Chores

* release 7.0.7 ([bb2c30d](https://github.com/zaggino/z-schema/commit/bb2c30d9ee95aaf130a485f8245bacda62fb5528))


## [7.0.6](https://github.com/zaggino/z-schema/compare/v7.0.5...v7.0.6) (2026-02-02)


### Features

* add typings for JsonSchema ([142879c](https://github.com/zaggino/z-schema/commit/142879c87bba0a9a44bd09b5d995ea0bc776d63f))
* improve utils typings ([9ed2763](https://github.com/zaggino/z-schema/commit/9ed2763708cfb13428a5d29b854c1c4db1a7a69c))
* improved typings and converted project to use TypeScript strict mode ([692f961](https://github.com/zaggino/z-schema/commit/692f96179ec74db58b8f53837e8d3ce8541662d7))


### Bug Fixes

* add env to gh workflow ([2d3b039](https://github.com/zaggino/z-schema/commit/2d3b03917b0990cb3ff7dd75ad3aff0b999b9959))


### Miscellaneous Chores

* release 7.0.6 ([b544b08](https://github.com/zaggino/z-schema/commit/b544b08dd9f3a5e12cbe2c82d287ac6ae13e1276))


## [7.0.5](https://github.com/zaggino/z-schema/compare/v7.0.4...v7.0.5) (2026-01-31)


### Bug Fixes

* add verbose arg to npm publish ([16228d2](https://github.com/zaggino/z-schema/commit/16228d211134e7f269f2e1837bf499462c9686b6))
* make sure we're using latest version of npm ([b4a80fc](https://github.com/zaggino/z-schema/commit/b4a80fc0701c2b12c5784a290057146a3963dfd9))
* eslint config file extension ([eb6117d](https://github.com/zaggino/z-schema/commit/eb6117dbc632122215e8972f71ff3dc0d55535bb))
* setup trusted publishing with npm ([02437ad](https://github.com/zaggino/z-schema/commit/02437adc10d8f05fe1f3bb51d166ca2b4492d7c1))
* add .nvmrc file ([88d1be5](https://github.com/zaggino/z-schema/commit/88d1be5a7c33ca9ff82528d52a6873439c26086e))

### Miscellaneous Chores

* release 7.0.5 ([8e862d6](https://github.com/zaggino/z-schema/commit/8e862d6eee0473b271799df69c1433adf892c7ae))


## [7.0.4](https://github.com/zaggino/z-schema/compare/v7.0.3...v7.0.4) (2026-01-31)

### Bug Fixes

* use latest version of npm in publish workflow

## [7.0.3](https://github.com/zaggino/z-schema/compare/v7.0.2...v7.0.3) (2026-01-31)

### Bug Fixes

* set up trusted publishing with npm
* fix ESLint config file extension

## [7.0.2](https://github.com/zaggino/z-schema/compare/v7.0.1...v7.0.2) (2026-01-31)

### Bug Fixes

* add `.nvmrc` file for consistent Node.js version

## [7.0.1](https://github.com/zaggino/z-schema/compare/v7.0.0...v7.0.1) (2026-01-31)

### Bug Fixes

* resolve circular dependency when building

### Documentation

* update README title
* fix broken link in README

## [7.0.0](https://github.com/zaggino/z-schema/compare/v6.0.2...v7.0.0) (2026-01-30)


### ⚠ BREAKING CHANGES

* **TypeScript / ESM rewrite** — Source converted from plain JavaScript to TypeScript. The library is now published as ES modules with CJS and UMD bundles.
* **Node.js >= 22 required** — The `engines` field now requires Node.js 22 or later.
* **New entry point** — `main` field replaced by `exports` map. Import `z-schema` (ESM), `z-schema/cjs` (CJS), or `z-schema/umd/ZSchema.js` (UMD). Direct deep imports like `z-schema/src/ZSchema` no longer work.
* **Source file renames** — All source files renamed from PascalCase (`ZSchema.js`, `FormatValidators.js`) to kebab-case (`z-schema.ts`, `format-validators.ts`). Any direct submodule imports will break.
* **Build tooling replaced** — Grunt + Jasmine replaced by Rollup + Vitest. Browserify bundles replaced by UMD bundle.

### Features

* convert entire codebase to TypeScript with strict mode
* publish CJS bundle (`z-schema/cjs`) and UMD bundle (`z-schema/umd/ZSchema.js`)
* add first-party TypeScript type declarations
* support Node.js 22 and 24
* add browser testing via Playwright

### Miscellaneous Chores

* migrate from Grunt to Rollup
* migrate from Jasmine to Vitest
* migrate from JSHint/JSCS to ESLint + Prettier


## [6.0.2](https://github.com/zaggino/z-schema/compare/v6.0.1...v6.0.2) (2024-07-29)

### Bug Fixes

* skip format validation when type check already failed

### Dependencies

* bump `commander` from 10.0.0 to 11.0.0
* bump `word-wrap` from 1.2.3 to 1.2.5

### Documentation

* remove deprecated david-dm dependency badges from README

## [6.0.1](https://github.com/zaggino/z-schema/compare/v6.0.0...v6.0.1) (2023-04-13)

### Miscellaneous Chores

* version bump

## [6.0.0](https://github.com/zaggino/z-schema/compare/v5.0.6...v6.0.0) (2023-04-12)

### ⚠ BREAKING CHANGES

* Drop support for Node.js < 16. CI now tests on Node.js 16 and 18 only.

## [5.0.6](https://github.com/zaggino/z-schema/compare/v5.0.5...v5.0.6) (2023-04-12)

### Features

* switch default branch to `main`
* add GitHub Actions CI workflow

### Bug Fixes

* ensure git submodules are fetched in CI
* add `browserify` to `package.json` dependencies

### Dependencies

* bump `commander` to 10.0.0
* bump `grunt` to 1.6.1
* bump `grunt-contrib-jasmine` to 4.0.0
* bump `grunt-browserify` to 6.0.0

## [5.0.5](https://github.com/zaggino/z-schema/compare/v5.0.3...v5.0.5) (2022-12-20)

### Dependencies

* bump `decode-uri-component` from 0.2.0 to 0.2.2 (security fix)

## [5.0.3](https://github.com/zaggino/z-schema/compare/v5.0.2...v5.0.3) (2022-04-09)

### Dependencies

* bump `minimist` from 1.2.5 to 1.2.6 (security fix)
* bump `cached-path-relative` from 1.0.2 to 1.1.0

## [5.0.2](https://github.com/zaggino/z-schema/compare/v5.0.1...v5.0.2) (2021-11-11)

### Dependencies

* bump `validator` from 13.6.0 to 13.7.0
* bump `path-parse` from 1.0.6 to 1.0.7 (security fix)

## [5.0.1](https://github.com/zaggino/z-schema/compare/v5.0.0...v5.0.1) (2021-05-12)

### Bug Fixes

* bump `validator` from 12.2.0 to 13.6.0 to fix ReDoS vulnerabilities
* correct `engines.node` field

## [5.0.0](https://github.com/zaggino/z-schema/compare/v4.2.4...v5.0.0) (2020-10-09)

### ⚠ BREAKING CHANGES

* `breakOnFirstError` now defaults to `false` (was `true`). All validation errors are reported by default. Set `breakOnFirstError: true` to restore previous behavior.

### Dependencies

* downgrade `validator` to ^12.0.0

## [4.2.4](https://github.com/zaggino/z-schema/compare/v4.2.3...v4.2.4) (2021-07-26)

### Miscellaneous Chores

* version bump

## [4.2.3](https://github.com/zaggino/z-schema/compare/v4.2.2...v4.2.3) (2020-04-24)

### Bug Fixes

* pass `null` instead of `undefined` when no error is present
* update `validator` to version 12.0.0
* fix `pedanticCheck` option handling

## [4.2.2](https://github.com/zaggino/z-schema/compare/v4.2.1...v4.2.2) (2019-11-08)

### Bug Fixes

* fix `multipleOf` validation for floating-point numbers by using integer-scaled arithmetic

## [4.2.1](https://github.com/zaggino/z-schema/compare/v4.2.0...v4.2.1) (2019-10-14)

### Bug Fixes

* pass validation context to `CustomValidatorFn` callback

## [4.2.0](https://github.com/zaggino/z-schema/compare/v4.1.1...v4.2.0) (2019-10-14)

### Miscellaneous Chores

* drop `core-js` polyfill for `Symbol`
* add Node.js 12 to CI matrix

## [4.1.1](https://github.com/zaggino/z-schema/compare/v4.1.0...v4.1.1) (2019-08-13)

### Bug Fixes

* update `core-js` to 3.2.1
* update `validator` to 11.0.0

### Performance

* optimize `Utils.cloneDeep` performance

## [4.1.0](https://github.com/zaggino/z-schema/compare/v4.0.2...v4.1.0) (2019-05-30)

### Features

* allow integer array indices in report path (push index as number instead of string)

## [4.0.2](https://github.com/zaggino/z-schema/compare/v4.0.1...v4.0.2) (2019-04-12)

### Miscellaneous Chores

* version bump, rebuild distribution files

## [4.0.1](https://github.com/zaggino/z-schema/compare/v4.0.0...v4.0.1) (2019-04-12)

### Bug Fixes

* fix infinite loop with circular `$ref` schemas by introducing ancestor report traversal

## [4.0.0](https://github.com/zaggino/z-schema/compare/v3.26.0...v4.0.0) (2019-04-05)

### ⚠ BREAKING CHANGES

* Drop support for Node.js < 10. CI now tests on Node.js 10, 12, and 14.

## [3.26.0](https://github.com/zaggino/z-schema/compare/v3.25.1...v3.26.0) (2019-04-05)

### Features

* add option to skip specific validation errors ([#266](https://github.com/zaggino/z-schema/issues/266))

## [3.25.1](https://github.com/zaggino/z-schema/compare/v3.25.0...v3.25.1) (2019-01-28)

### Miscellaneous Chores

* version bump, rebuild distribution files

## [3.25.0](https://github.com/zaggino/z-schema/compare/v3.24.3...v3.25.0) (2019-01-23)

### Bug Fixes

* `OBJECT_ADDITIONAL_PROPERTIES` errors are now reported individually (ungrouped) for clearer messages

## [3.24.3](https://github.com/zaggino/z-schema/compare/v3.24.2...v3.24.3) (2019-01-21)

### Bug Fixes

* async format validator now returns correct path ([#209](https://github.com/zaggino/z-schema/issues/209))

## [3.24.2](https://github.com/zaggino/z-schema/compare/v3.24.1...v3.24.2) (2018-11-26)

### Miscellaneous Chores

* refresh compiled distribution files

## [3.24.1](https://github.com/zaggino/z-schema/compare/v3.23.0...v3.24.1) (2018-09-24)

### Refactoring

* modernize source files (ES6 exports, JSHint ES6 mode)
* add TypeScript declarations (`index.d.ts`)

## [3.23.0](https://github.com/zaggino/z-schema/compare/v3.22.0...v3.23.0) (2018-08-11)

### Features

* include schema `title` in error objects when available

### Miscellaneous Chores

* update CI to Node.js 10

## [3.22.0](https://github.com/zaggino/z-schema/compare/v3.21.0...v3.22.0) (2018-05-17)

### Refactoring

* move `type` check together with other validators so it can be rewired

## [3.21.0](https://github.com/zaggino/z-schema/compare/v3.20.0...v3.21.0) (2018-05-13)

### Features

* pass `validateOptions` through to format validators

### Dependencies

* update `validator` to 10.0.0

## [3.20.0](https://github.com/zaggino/z-schema/compare/v3.19.1...v3.20.0) (2018-04-24)

### Features

* report enum case mismatch as a separate error code

### Bug Fixes

* remove trailing full stop from error messages
* remove ES6 syntax to maintain compatibility

## [3.19.1](https://github.com/zaggino/z-schema/compare/v3.19.0...v3.19.1) (2018-02-05)

### Bug Fixes

* fix skipping of async format validators

## [3.19.0](https://github.com/zaggino/z-schema/compare/v3.18.4...v3.19.0) (2017-11-15)

### Features

* add `validationOptions` parameter to `setRemoteReference()` for per-schema validation settings
* disable strict validation for built-in meta-schemas to avoid false positives

### Bug Fixes

* normalize options passed to `setRemoteReference()`

### Dependencies

* update `validator` to 9.0.0

## [3.18.4](https://github.com/zaggino/z-schema/compare/v3.18.3...v3.18.4) (2017-09-18)

### Documentation

* move package name to the top of README
* add Greenkeeper badge

## [3.18.3](https://github.com/zaggino/z-schema/compare/v3.18.2...v3.18.3) (2017-08-19)

### Bug Fixes

* use `Map` for reference cache when available for improved performance
* fix README headings per CommonMark spec
* fix `strictMode` documentation

### Miscellaneous Chores

* add Node.js 8 to CI

## [3.18.2](https://github.com/zaggino/z-schema/compare/v3.18.1...v3.18.2) (2016-12-03)

### Dependencies

* upgrade `validator` dependency to latest version

## [3.18.1](https://github.com/zaggino/z-schema/compare/v3.18.0...v3.18.1) (2016-11-21)

### Bug Fixes

* do not duplicate same schema of different instance in cache

### Documentation

* add dependency status badges to README

## [3.18.0](https://github.com/zaggino/z-schema/compare/v3.17.0...v3.18.0) (2016-09-21)

### Features

* remove `request` as a runtime dependency (schema downloading is now user-provided)

### Bug Fixes

* fix peer dependency issues with Grunt 4 / Node.js 0.10
* support Node.js 0.12

### Documentation

* set correct language on code snippets in README

## [3.17.0](https://github.com/zaggino/z-schema/compare/v3.16.1...v3.17.0) (2016-04-06)

### Features

* add support for custom validators via `customValidator` option
* allow `Report.getPath()` to return both string and array formats

### Bug Fixes

* constrain Grunt version to 0.4.x

### Dependencies

* update `lodash.get` and `validator` dependencies

### Documentation

* fix incorrect repository URL

## [3.16.1](https://github.com/zaggino/z-schema/compare/v3.16.0...v3.16.1) (2015-12-04)

### Bug Fixes

* add tests for issue [#151](https://github.com/zaggino/z-schema/issues/151)

## [3.16.0](https://github.com/zaggino/z-schema/compare/v3.15.4...v3.16.0) (2015-11-03)

### Features

* add `schemaId` property to error objects ([#147](https://github.com/zaggino/z-schema/issues/147))

### Bug Fixes

* fix validation regression ([#142](https://github.com/zaggino/z-schema/issues/142))

## [3.15.4](https://github.com/zaggino/z-schema/compare/v3.15.2...v3.15.4) (2015-10-22)

### Bug Fixes

* handle incorrect `id` keyword gracefully ([#146](https://github.com/zaggino/z-schema/issues/146))
* run lint on `npm test`

## [3.15.2](https://github.com/zaggino/z-schema/compare/v3.15.1...v3.15.2) (2015-09-18)

### Miscellaneous Chores

* version bump, rebuild distribution files

## [3.15.1](https://github.com/zaggino/z-schema/compare/v3.15.0...v3.15.1) (2015-09-18)

### Bug Fixes

* more descriptive error for invalid subschema ([#138](https://github.com/zaggino/z-schema/issues/138))
* fix test regression ([#137](https://github.com/zaggino/z-schema/issues/137))

## [3.15.0](https://github.com/zaggino/z-schema/compare/v3.14.2...v3.15.0) (2015-09-11)

### Features

* support `uuid` format validation

## [3.14.2](https://github.com/zaggino/z-schema/compare/v3.14.1...v3.14.2) (2015-09-15)

### Bug Fixes

* more descriptive error for invalid subschema
* add additional test coverage for [#137](https://github.com/zaggino/z-schema/issues/137)

## [3.14.1](https://github.com/zaggino/z-schema/compare/v3.14.0...v3.14.1) (2015-09-11)

### Miscellaneous Chores

* version bump, rebuild distribution files

## [3.14.0](https://github.com/zaggino/z-schema/compare/v3.13.0...v3.14.0) (2015-09-11)

### Features

* validate against subschema via JSON Pointer path

## [3.13.0](https://github.com/zaggino/z-schema/compare/v3.12.5...v3.13.0) (2015-09-04)

### Features

* support for ignoring unknown formats via `ignoreUnknownFormats` option

### Bug Fixes

* top-level errors no longer obscure deeper nested errors

## [3.12.5](https://github.com/zaggino/z-schema/compare/v3.12.4...v3.12.5) (2015-09-02)

### Bug Fixes

* improve escaping of forward slashes in JSON Pointer paths

## [3.12.4](https://github.com/zaggino/z-schema/compare/v3.12.3...v3.12.4) (2015-08-21)

### Bug Fixes

* fix issue [#127](https://github.com/zaggino/z-schema/issues/127) — incorrect schema caching behavior

## [3.12.3](https://github.com/zaggino/z-schema/compare/v3.12.2...v3.12.3) (2015-08-19)

### Bug Fixes

* fix [#125](https://github.com/zaggino/z-schema/issues/125)

## [3.12.2](https://github.com/zaggino/z-schema/compare/v3.12.1...v3.12.2) (2015-08-13)

### Bug Fixes

* fix issues [#123](https://github.com/zaggino/z-schema/issues/123), [#124](https://github.com/zaggino/z-schema/issues/124), [#125](https://github.com/zaggino/z-schema/issues/125)
* `getMissingReferences` now resolves recursively

## [3.12.1](https://github.com/zaggino/z-schema/compare/v3.12.0...v3.12.1) (2015-08-11)

### Bug Fixes

* do not add `UNRESOLVABLE_REFERENCE` when `REMOTE_NOT_VALID` is already present
* properly delete keys from schema cache
* print error messages to console on validation failure in CLI

### Documentation

* fix typos in README

## [3.12.0](https://github.com/zaggino/z-schema/compare/v3.11.0...v3.12.0) (2015-06-15)

### Features

* add `getRegisteredFormats()` helper method
* add support for `pedanticCheck` option

## [3.11.0](https://github.com/zaggino/z-schema/compare/v3.10.2...v3.11.0) (2015-06-08)

### Features

* add `pedanticCheck` option for strict schema best-practice checks

### Bug Fixes

* validate `default` and `enum` values correctly ([#110](https://github.com/zaggino/z-schema/issues/110))

## [3.10.2](https://github.com/zaggino/z-schema/compare/v3.10.1...v3.10.2) (2015-05-20)

### Bug Fixes

* return correct exit code for Node.js 0.10 in CLI

## [3.10.1](https://github.com/zaggino/z-schema/compare/v3.10.0...v3.10.1) (2015-05-20)

### Bug Fixes

* set `process.exitCode = 1` on failed CLI validation

## [3.10.0](https://github.com/zaggino/z-schema/compare/v3.9.5...v3.10.0) (2015-05-18)

### Features

* implement `setSchemaReader()` for pluggable remote schema loading

## [3.9.5](https://github.com/zaggino/z-schema/compare/v3.9.4...v3.9.5) (2015-05-06)

### Bug Fixes

* fix [#106](https://github.com/zaggino/z-schema/issues/106)

## [3.9.4](https://github.com/zaggino/z-schema/compare/v3.9.3...v3.9.4) (2015-04-29)

### Bug Fixes

* fire callback in async mode when validation fails during compilation step

## [3.9.3](https://github.com/zaggino/z-schema/compare/v3.9.2...v3.9.3) (2015-04-29)

### Bug Fixes

* support circular references in `deepClone` — drop dependency on external clone library
* handle circular references when resolving `$ref`

## [3.9.2](https://github.com/zaggino/z-schema/compare/v3.9.1...v3.9.2) (2015-04-24)

### Bug Fixes

* add input validation for public API methods

### Documentation

* update README

## [3.9.1](https://github.com/zaggino/z-schema/compare/v3.9.0...v3.9.1) (2015-03-30)

### Miscellaneous Chores

* version bump

## [3.9.0](https://github.com/zaggino/z-schema/compare/v3.8.0...v3.9.0) (2015-03-30)

### Features

* bundle default JSON Schema meta-schemas with z-schema ([#99](https://github.com/zaggino/z-schema/issues/99))

### Bug Fixes

* lock `validator` dependency version

## [3.8.0](https://github.com/zaggino/z-schema/compare/v3.7.1...v3.8.0) (2015-03-26)

### Features

* when validating `oneOf`, return only one error per branch instead of all nested errors

## [3.7.1](https://github.com/zaggino/z-schema/compare/v3.7.0...v3.7.1) (2015-03-23)

### Bug Fixes

* use `validator` library for IPv6 validation
* update `validator` version

## [3.7.0](https://github.com/zaggino/z-schema/compare/v3.6.1...v3.7.0) (2015-03-22)

### Features

* read `$ref` from local filesystem when using CLI ([#97](https://github.com/zaggino/z-schema/issues/97))

## [3.6.1](https://github.com/zaggino/z-schema/compare/v3.6.0...v3.6.1) (2015-03-13)

### Bug Fixes

* use `validator` library for strict URI and IPv4 validation ([#96](https://github.com/zaggino/z-schema/issues/96))
* in `noTypeless` mode, `type` is not required when `enum` is defined

## [3.6.0](https://github.com/zaggino/z-schema/compare/v3.5.2...v3.6.0) (2015-03-09)

### Features

* add `forceMinItems`, `forceMaxItems`, and `forceMinLength` strict-mode options

### Bug Fixes

* `forceMaxLength` no longer throws when `pattern` is defined

## [3.5.2](https://github.com/zaggino/z-schema/compare/v3.5.1...v3.5.2) (2015-03-04)

### Bug Fixes

* `noEmptyStrings` — do not add `minLength` to strings with `format` defined

## [3.5.1](https://github.com/zaggino/z-schema/compare/v3.5.0...v3.5.1) (2015-03-04)

### Bug Fixes

* `noEmptyStrings` — do not add `minLength` for enums

## [3.5.0](https://github.com/zaggino/z-schema/compare/v3.4.3...v3.5.0) (2015-03-04)

### Bug Fixes

* fix issue [#94](https://github.com/zaggino/z-schema/issues/94)

### Documentation

* update README browser usage example

## [3.4.3](https://github.com/zaggino/z-schema/compare/v3.4.2...v3.4.3) (2015-02-06)

### Bug Fixes

* fix display of URI in error paths
* fix infinite loop with automatic schema loading
* fix CLI usage example
* output full help if no arguments given

## [3.4.2](https://github.com/zaggino/z-schema/compare/v3.4.1...v3.4.2) (2015-02-03)

### Bug Fixes

* fix Unicode code point tests from JSON Schema Test Suite

## [3.4.1](https://github.com/zaggino/z-schema/compare/v3.4.0...v3.4.1) (2015-02-03)

### Bug Fixes

* fix [#88](https://github.com/zaggino/z-schema/issues/88)

### Documentation

* add CLI usage to README
* add Coveralls badge

## [3.4.0](https://github.com/zaggino/z-schema/compare/v3.3.3...v3.4.0) (2015-02-02)

### Bug Fixes

* fix [#84](https://github.com/zaggino/z-schema/issues/84)
* fix [#85](https://github.com/zaggino/z-schema/issues/85)
* fix typo ([#87](https://github.com/zaggino/z-schema/issues/87))

## [3.3.3](https://github.com/zaggino/z-schema/compare/v3.3.2...v3.3.3) (2015-01-30)

### Bug Fixes

* fix [#83](https://github.com/zaggino/z-schema/issues/83)

## [3.3.2](https://github.com/zaggino/z-schema/compare/v3.3.1...v3.3.2) (2015-01-28)

### Bug Fixes

* fix [#73](https://github.com/zaggino/z-schema/issues/73)
* fix report object error handling

## [3.3.1](https://github.com/zaggino/z-schema/compare/v3.3.0...v3.3.1) (2014-12-23)

### Bug Fixes

* fix circular dependencies ([#76](https://github.com/zaggino/z-schema/issues/76))

## [3.3.0](https://github.com/zaggino/z-schema/compare/v3.2.0...v3.3.0) (2014-12-17)

### Features

* implement `breakOnFirstError` option to stop validation after first error

### Bug Fixes

* fix `additionalProperties` handling
* fix outstanding issues

## [3.2.0](https://github.com/zaggino/z-schema/compare/v3.1.5...v3.2.0) (2014-12-11)

### Bug Fixes

* fix errors in browserify and uglify settings ([#70](https://github.com/zaggino/z-schema/issues/70))

## [3.1.5](https://github.com/zaggino/z-schema/compare/v3.1.4...v3.1.5) (2014-11-25)

### Bug Fixes

* fix bug in validating remote schemas ([#67](https://github.com/zaggino/z-schema/issues/67))

## [3.1.4](https://github.com/zaggino/z-schema/compare/v3.1.3...v3.1.4) (2014-11-22)

### Bug Fixes

* fix [#66](https://github.com/zaggino/z-schema/issues/66)

## [3.1.3](https://github.com/zaggino/z-schema/compare/v3.1.2...v3.1.3) (2014-11-14)

### Bug Fixes

* make error paths reported for missing references consistent

## [3.1.2](https://github.com/zaggino/z-schema/compare/v3.1.1...v3.1.2) (2014-11-02)

### Bug Fixes

* fix [#63](https://github.com/zaggino/z-schema/issues/63)

## [3.1.1](https://github.com/zaggino/z-schema/compare/v3.1.0...v3.1.1) (2014-11-02)

### Bug Fixes

* fix [#63](https://github.com/zaggino/z-schema/issues/63) (additional fixes)

### Documentation

* update README

## [3.1.0](https://github.com/zaggino/z-schema/compare/v3.0.4...v3.1.0) (2014-10-28)

### Features

* report string error paths as JSON Pointer format
* add `reportPathAsArray` option for array-based path segments

## [3.0.4](https://github.com/zaggino/z-schema/compare/v3.0.3...v3.0.4) (2014-10-27)

### Bug Fixes

* fix [#58](https://github.com/zaggino/z-schema/issues/58)

## [3.0.3](https://github.com/zaggino/z-schema/compare/v3.0.2...v3.0.3) (2014-10-23)

### Miscellaneous Chores

* version bump

## [3.0.2](https://github.com/zaggino/z-schema/compare/v3.0.1...v3.0.2) (2014-10-23)

### Bug Fixes

* fix [#56](https://github.com/zaggino/z-schema/issues/56)
* fix [#57](https://github.com/zaggino/z-schema/issues/57)
* rebuild browser distribution

## [3.0.1](https://github.com/zaggino/z-schema/compare/v3.0.0...v3.0.1) (2014-09-20)

### Bug Fixes

* do not include `request` in browser test bundle

### Performance

* check `type` first as it is the most common failing keyword

### Documentation

* add Bower badge

## [3.0.0](https://github.com/zaggino/z-schema/releases/tag/v3.0.0) (2014-08-20)

### ⚠ BREAKING CHANGES

* Complete rewrite of z-schema with new options API.
* New strict-mode options: `noEmptyStrings`, `noTypeless`, `forceItems`, `forceMaxLength`, `forceProperties`, `ignoreUnresolvableReferences`, `noExtraKeywords`, `noEmptyArrays`.

### Features

* support multiple linked schemas
* support remote schema downloading
* prefill values using `format`
