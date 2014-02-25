describe('browser based ZSchema', function () {
    var schema = {
        "$schema":     "http://json-schema.org/draft-04/schema#",
        "required":    ["id", "name"],
        "type":        "object",
        "properties":  {
            "id":   {
                "type":    "number",
                "default": 100
            },
            "name": {
                "type": "string"
            },

            "address":   {
                "type":  "array",
                "items": [
                    {
                        "title": "address",
                        "type":  "string"
                    },
                    {
                        "title":   "city",
                        "type":    "string",
                        "default": "San Francisco"
                    },
                    {
                        "title":   "state",
                        "type":    "string",
                        "maxSize": 2,
                        "default": "CA"
                    }
                ]
            },
            "purchases": {
                "$ref": "#/definitions/productList"
            },

            "shoppingCart": {
                "$ref": "#/definitions/productList"
            },

            "options": {
                "type":     "array",
                "items":    {
                    "$ref": "#/definitions/option"
                },
                "minItems": 3,
                "maxItems": 3
            }
        },
        "definitions": {
            "productList": {
                "type":  "array",
                "items": {
                    "$ref": "#/definitions/product"
                }
            },

            "currency": {
                "type": "number"
            },

            "product": {
                "type":       "object",
                "properties": {
                    "cost": {
                        "$ref": "#/definitions/currency"
                    },
                    "name": {
                        "type": "string"
                    }
                }
            },

            "option": {
                "type":       "object",
                "properties": {
                    "name":  {
                        "type": "string"
                    },
                    "value": {
                        "type": "number"
                    }
                }
            }
        }
    };
    var validator;

    before(function(){

        validator = new ZSchema({ sync: true });
    })

    it('should be able to validate data', function () {
        assert(validator.validate({id: 1, name: 'foo'}, schema), 'basic data is valid');
    })

    it('should be able to invalidate bad data', function () {
        assert(!validator.validate({id: 'bar', name: 'foo'}, schema), 'basic data is valid');
    })
})