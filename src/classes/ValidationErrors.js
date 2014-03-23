
    /***** ValidationError class *****/

    var ValidationError = function (code, message, params, path) {
        this.code    = code;
        this.message = message;
        this.path    = path || '';
        this.params  = params || {};
    };

    ValidationError.prototype = new Error();

    ValidationError.messages = {
        'INVALID_TYPE': 'invalid type: {type} (expected {expected})',
        'ENUM_MISMATCH': 'No enum match for: {value}',
        'ANY_OF_MISSING': 'Data does not match any schemas from "anyOf"',
        'ONE_OF_MISSING': 'Data does not match any schemas from "oneOf"',
        'ONE_OF_MULTIPLE': 'Data is valid against more than one schema from "oneOf"',
        'NOT_PASSED': 'Data matches schema from "not"',
        'UNRESOLVABLE_REFERENCE': 'Reference could not be resolved: {ref}',
        // Numeric errors
        'MULTIPLE_OF': 'Value {value} is not a multiple of {multipleOf}',
        'MINIMUM': 'Value {value} is less than minimum {minimum}',
        'MINIMUM_EXCLUSIVE': 'Value {value} is equal or less than exclusive minimum {minimum}',
        'MAXIMUM': 'Value {value} is greater than maximum {maximum}',
        'MAXIMUM_EXCLUSIVE': 'Value {value} is equal or greater than exclusive maximum {maximum}',
        // String errors
        'MIN_LENGTH': 'String is too short ({length} chars), minimum {minimum}',
        'MAX_LENGTH': 'String is too long ({length} chars), maximum {maximum}',
        'PATTERN': 'String does not match pattern: {pattern}',
        // Object errors
        'OBJECT_PROPERTIES_MINIMUM': 'Too few properties defined ({count}), minimum {minimum}',
        'OBJECT_PROPERTIES_MAXIMUM': 'Too many properties defined ({count}), maximum {maximum}',
        'OBJECT_REQUIRED': 'Missing required property: {property}',
        'OBJECT_ADDITIONAL_PROPERTIES': 'Additional properties not allowed',
        'OBJECT_DEPENDENCY_KEY': 'Dependency failed - key must exist: {missing} (due to key: {key})',
        // Array errors
        'ARRAY_LENGTH_SHORT': 'Array is too short ({length}), minimum {minimum}',
        'ARRAY_LENGTH_LONG': 'Array is too long ({length}), maximum {maximum}',
        'ARRAY_UNIQUE': 'Array items are not unique (indices {index1} and {index2})',
        'ARRAY_ADDITIONAL_ITEMS': 'Additional items not allowed',
        // Format errors
        'FORMAT': '{format} format validation failed: {error}',
        // Schema validation errors
        'KEYWORD_TYPE_EXPECTED': 'Keyword "{keyword}" is expected to be of type "{type}"',
        'KEYWORD_UNDEFINED_STRICT': 'Keyword "{keyword}" must be defined in strict mode',
        'KEYWORD_UNEXPECTED': 'Keyword "{keyword}" is not expected to appear in the schema',
        'KEYWORD_MUST_BE': 'Keyword "{keyword}" must be {expression}',
        'KEYWORD_DEPENDENCY': 'Keyword "{keyword1}" requires keyword "{keyword2}"',
        'KEYWORD_PATTERN': 'Keyword "{keyword}" is not a valid RegExp pattern ({pattern})',
        'KEYWORD_VALUE_TYPE': 'Each element of keyword "{keyword}" array must be a "{type}"',
        'UNKNOWN_FORMAT': 'There is no validation function for format "{format}"',
        // Remote errors
        'SCHEMA_NOT_REACHABLE': 'Validator was not able to read schema located at {uri}',
        'SCHEMA_TYPE_EXPECTED': 'Schema is expected to be of type "object"'
    };

    ValidationError.prototype.addSubError = function (err) {
        if (!this.subErrors) { this.subErrors = []; }
        this.subErrors.push(err);
    };

    ValidationError.createError = function (code, params, path) {
        var msg = ValidationError.messages[code];
        params  = params || {};

        if (typeof msg !== 'string') {
            throw new Error('Unknown error code: ' + code);
        }

        msg = msg.replace(/\{([^{}]*)\}/g, function (whole, varName) {
            var subValue = params[varName];
            if (typeof subValue === 'string' || typeof subValue === 'number') {
                return subValue;
            }
            if (subValue && typeof subValue.toString === 'function') {
                return subValue.toString();
            }
            return whole;
        });

        return new ValidationError(code, msg, params, path);
    };

    var CustomFormatValidators = {};
