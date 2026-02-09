import type { JsonSchema } from '../../src/json-schema.ts';

import { ZSchema } from '../../src/z-schema.js';

describe('Issue #165: $ref resolution in nested external schemas', () => {
  it('should resolve $ref correctly relative to containing schema', () => {
    const validator = ZSchema.create();

    // Simulate the schemas from the issue
    const memberSchema: JsonSchema = {
      type: 'string',
    };

    const itemsSchema: JsonSchema = {
      type: 'object',
      properties: {
        member: {
          $ref: 'member.json',
        },
      },
    };

    const mainSchema: JsonSchema = {
      type: 'array',
      items: {
        $ref: 'defs/items.json',
      },
    };

    // Set the remote references as the CLI would
    validator.setRemoteReference('defs/items.json', itemsSchema);
    validator.setRemoteReference('defs/member.json', memberSchema);

    // Set id for main schema as CLI does
    mainSchema.id = 'main.json';

    // Validate the schema
    const result = validator.validateSchemaSafe(mainSchema);

    expect(result.valid).toBe(true);
  });

  it('should validate data correctly with nested $refs', () => {
    const validator = ZSchema.create();

    // Same schemas
    const memberSchema: JsonSchema = {
      type: 'string',
    };

    const itemsSchema: JsonSchema = {
      type: 'object',
      properties: {
        member: {
          $ref: 'member.json',
        },
      },
    };

    const mainSchema: JsonSchema = {
      type: 'array',
      items: {
        $ref: 'defs/items.json',
      },
    };

    validator.setRemoteReference('defs/items.json', itemsSchema);
    validator.setRemoteReference('defs/member.json', memberSchema);
    mainSchema.id = 'main.json';

    // Compile the schema first
    const schemaResult = validator.validateSchemaSafe(mainSchema);
    expect(schemaResult.valid).toBe(true);

    // Now validate data
    const data = [{ member: 'test' }];
    const dataResult = validator.validate(data, mainSchema);

    expect(dataResult).toBe(true);
  });
});
