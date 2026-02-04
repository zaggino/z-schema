# Changelog

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

## [7.0.5](https://github.com/zaggino/z-schema/compare/v7.0.0...v7.0.5) (2026-01-31)


### Bug Fixes

* add verbose arg to npm publish ([16228d2](https://github.com/zaggino/z-schema/commit/16228d211134e7f269f2e1837bf499462c9686b6))
* make sure we're using latest version of npm ([b4a80fc](https://github.com/zaggino/z-schema/commit/b4a80fc0701c2b12c5784a290057146a3963dfd9))
* eslint config file extension ([eb6117d](https://github.com/zaggino/z-schema/commit/eb6117dbc632122215e8972f71ff3dc0d55535bb))
* setup trusted publishing with npm ([02437ad](https://github.com/zaggino/z-schema/commit/02437adc10d8f05fe1f3bb51d166ca2b4492d7c1))
* add .nvmrc file ([88d1be5](https://github.com/zaggino/z-schema/commit/88d1be5a7c33ca9ff82528d52a6873439c26086e))

### Miscellaneous Chores

* release 7.0.5 ([8e862d6](https://github.com/zaggino/z-schema/commit/8e862d6eee0473b271799df69c1433adf892c7ae))

## [7.0.0](https://github.com/zaggino/z-schema/compare/v6.0.2...v7.0.0) (2026-01-30)


### Changes

* Update README
* Fix lint config and issues
* Fix formatting
* Beta version
* Publish workflow
* ESLint
* Format sources
* Prettier
* Migrate copy script
* Publish commonjs export and own types
* Cleanup
* Convert to TypeScript
* Add Playwright step to gh workflow
* Fix failing tests
* Testing in browsers
* Conversion to ESM
* Support Node.js 22 and 24
* Moving away from Jasmine to Vitest
* Moving away from Grunt to Rollup
