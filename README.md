# z-schema - a JSON Schema validator

[![NPM](https://nodei.co/npm/z-schema.png?downloads=true&downloadRank=true)](https://www.npmjs.com/package/z-schema)

[![coverage status](https://coveralls.io/repos/zaggino/z-schema/badge.svg)](https://coveralls.io/r/zaggino/z-schema)

## Topics

- [What](#what)
- [Versions](#versions)
- [Usage](#usage)
- [Features](#features)
- [Options](#options)
- [Contributing](#contributing)
- [Contributors](#contributors)

## What

What is a JSON Schema? Find here: [https://json-schema.org/](https://json-schema.org/)

## Versions

- v6 - old version which has been around a long time, supports JSON Schema draft-04
- v7 - modernized version (to ESM module with Typescript) which passes all tests from JSON Schema Test Suite for draft-04

## Usage

Validator will try to perform sync validation when possible for speed, but supports async callbacks when they are necessary.

### ESM and Typescript:

```javascript
import ZSchema from 'z-schema';
const validator = new ZSchema();
console.log(validator.validate(1, { type: 'number' })); // true
console.log(validator.validate(1, { type: 'string' })); // false
```

### CommonJs:

```javascript
const ZSchema = require('z-schema');
const validator = new ZSchema();
console.log(validator.validate(1, { type: 'number' })); // true
console.log(validator.validate(1, { type: 'string' })); // false
```

### CLI:

```bash
npm install --global z-schema
z-schema --help
z-schema mySchema.json
z-schema mySchema.json myJson.json
z-schema --strictMode mySchema.json myJson.json
```

### Sync mode:

```javascript
var valid = validator.validate(json, schema);
// this will return a native error object with name and message
var error = validator.getLastError();
// this will return an array of validation errors encountered
var errors = validator.getLastErrors();
...
```

### Async mode:

```javascript
validator.validate(json, schema, function (err, valid) {
    ...
});
```

### Browser:

```html
<script type="text/javascript" src="z-schema/umd/ZSchema.min.js"></script>
<script type="text/javascript">
  var validator = new ZSchema();
  console.log(validator.validate('string', { type: 'string' }));
</script>
```

### Remote references and schemas:

In case you have some remote references in your schemas, you have to download those schemas before using validator.
Otherwise you'll get `UNRESOLVABLE_REFERENCE` error when trying to compile a schema.

```javascript
var validator = new ZSchema();
var json = {};
var schema = { "$ref": "http://json-schema.org/draft-04/schema#" };

var valid = validator.validate(json, schema);
var errors = validator.getLastErrors();
// valid === false
// errors.length === 1
// errors[0].code === "UNRESOLVABLE_REFERENCE"

var requiredUrl = "http://json-schema.org/draft-04/schema";
request(requiredUrl, function (error, response, body) {

    validator.setRemoteReference(requiredUrl, JSON.parse(body));

    var valid = validator.validate(json, schema);
    var errors = validator.getLastErrors();
    // valid === true
    // errors === undefined

}
```

If you're able to load schemas synchronously, you can use `ZSchema.setSchemaReader` feature:

```javascript
ZSchema.setSchemaReader(function (uri) {
  var someFilename = path.resolve(__dirname, '..', 'schemas', uri + '.json');
  return JSON.parse(fs.readFileSync(someFilename, 'utf8'));
});
```

## Features

See [FEATURES.md](FEATURES.md) for a full list of features.

## Options

See [OPTIONS.md](OPTIONS.md) for all available options and their descriptions.

## Contributing

These repository has several submodules and should be cloned as follows:

> git clone **--recursive** https://github.com/zaggino/z-schema.git

## Contributors

Big thanks to:

<!-- readme: contributors -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/zaggino">
                    <img src="https://avatars.githubusercontent.com/u/1067319?v=4" width="100;" alt="zaggino"/>
                    <br />
                    <sub><b>Martin Zagora</b></sub>
                </a>
            </td>
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
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/whitlockjc">
                    <img src="https://avatars.githubusercontent.com/u/98899?v=4" width="100;" alt="whitlockjc"/>
                    <br />
                    <sub><b>Jeremy Whitlock</b></sub>
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
                <a href="https://github.com/toofishes">
                    <img src="https://avatars.githubusercontent.com/u/265817?v=4" width="100;" alt="toofishes"/>
                    <br />
                    <sub><b>Dan McGee</b></sub>
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
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/Hirse">
                    <img src="https://avatars.githubusercontent.com/u/2564094?v=4" width="100;" alt="Hirse"/>
                    <br />
                    <sub><b>Jan Pilzer</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/geraintluff">
                    <img src="https://avatars.githubusercontent.com/u/1957191?v=4" width="100;" alt="geraintluff"/>
                    <br />
                    <sub><b>Geraint</b></sub>
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
<!-- readme: contributors -end -->

and to everyone submitting [issues](https://github.com/zaggino/z-schema/issues) on GitHub
