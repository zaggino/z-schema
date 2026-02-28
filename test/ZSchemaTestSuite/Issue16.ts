export default {
  description: 'Issue #16 - schemas should be validated by references in $schema property',
  setup: (_validator: any, ZSchema: any) => {
    ZSchema.setSchemaReader((filePath: any) => {
      if (filePath === 'http://json-schema.org/draft-04/hyper-schema') {
        return {
          id: 'http://json-schema.org/draft-04/hyper-schema#',
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'object',
          properties: {
            links: {
              type: 'array',
            },
          },
        };
      }
      throw new Error(filePath);
    });
  },
  tests: [
    {
      description: 'should pass validation',
      schema: {
        $schema: 'http://json-schema.org/draft-04/hyper-schema#',
        links: [],
      },
      validateSchemaOnly: true,
      valid: true,
    },
    {
      description: 'should fail validation',
      schema: {
        $schema: 'http://json-schema.org/draft-04/hyper-schema#',
        links: null,
      },
      validateSchemaOnly: true,
      valid: false,
    },
  ],
};
