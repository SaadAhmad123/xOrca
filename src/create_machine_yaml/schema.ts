import Ajv from 'ajv';

/**
 * JSON schema for validating state machine configuration.
 */
export const orchestratorStateMachineSchemaValidator = new Ajv().compile({
  definitions: {
    TransitionConfig: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        actions: {
          anyOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'string' },
          ],
        },
        guard: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['target'],
      additionalProperties: false,
    },
    State: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: ['parallel', 'final'] },
        initial: { type: 'string' },
        entry: {
          anyOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'string' },
          ],
        },
        exit: {
          anyOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'string' },
          ],
        },
        on: {
          type: 'object',
          additionalProperties: {
            anyOf: [
              { $ref: '#/definitions/TransitionConfig' },
              {
                type: 'array',
                items: { $ref: '#/definitions/TransitionConfig' },
              },
            ],
          },
        },
        onDone: {
          anyOf: [
            { $ref: '#/definitions/TransitionConfig' },
            {
              type: 'array',
              items: { $ref: '#/definitions/TransitionConfig' },
            },
          ],
        },
        always: {
          anyOf: [
            { $ref: '#/definitions/TransitionConfig' },
            {
              type: 'array',
              items: { $ref: '#/definitions/TransitionConfig' },
            },
          ],
        },
        tags: {
          anyOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'string' },
          ],
        },
        description: { type: 'string' },
        states: {
          type: 'object',
          additionalProperties: { $ref: '#/definitions/State' },
        },
      },
      additionalProperties: false,
    },
  },
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['parallel'] },
    initial: { type: 'string' },
    context: { type: 'object' },
    states: {
      type: 'object',
      additionalProperties: { $ref: '#/definitions/State' },
    },
  },
  required: ['id', 'states'],
  additionalProperties: false,
  if: {
    properties: { type: { const: 'parallel' } },
    required: ['type'],
  },
  then: { not: { required: ['initial'] } },
  else: { required: ['initial'] },
});
