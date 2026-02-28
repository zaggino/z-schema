const innerSchema = {
  type: 'integer',
};

const originalSchema = {
  type: 'object',
  properties: {
    inner: innerSchema,
  },
};

const getKeys = function (obj: any) {
  const arr: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      arr.push(key);
    }
  }
  return arr;
};

const originalSchemaKeys = getKeys(originalSchema);
const innerSchemaKeys = getKeys(innerSchema);

export default {
  description: "Issue #85 - zschema shouldn't have side effects on the schema object",
  tests: [
    {
      description: 'should pass validation',
      schema: originalSchema,
      data: {
        inner: 5,
      },
      valid: true,
      after: function () {
        expect(getKeys(originalSchema).length).toBe(originalSchemaKeys.length);
        expect(getKeys(innerSchemaKeys).length).toBe(innerSchemaKeys.length);
      },
    },
  ],
};
