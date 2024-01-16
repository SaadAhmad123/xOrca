import * as jsYaml from 'js-yaml';
import { assign, createMachine } from 'xstate';
import { orchestratorStateMachineSchemaValidator } from './schema';
import { CreateMachineYamlError } from './errors';
import { ICreateMachineYamlOptions } from './types';
import { assignEventDataToContext, assignLogsToContext } from '../utils';

/**
 * Creates a state machine from a YAML string.
 * @param yamlString - YAML string representing the state machine configuration.
 * @param options - Options for YAML parsing and machine creation.
 * @returns Object containing the created machine and the parsed JSON.
 * @throws {CreateMachineYamlError} - Throws an error if YAML validation fails.
 */
export function createMachineYaml<TContext extends Record<string, any>>(
  yamlString: string,
  options?: ICreateMachineYamlOptions<TContext>,
) {
  const jsonObj: any = jsYaml.load(yamlString, {
    onWarning: options?.onWarningYamlParse,
    json: false,
  });
  if (!orchestratorStateMachineSchemaValidator(jsonObj)) {
    throw new CreateMachineYamlError(
      `YAML validation error. See 'details' property for more information. ${JSON.stringify(
        orchestratorStateMachineSchemaValidator.errors,
      )}`,
      orchestratorStateMachineSchemaValidator.errors,
    );
  }

  const machine = createMachine(
    {
      /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgAoBbAQwGMALASwzAEp8QAHLWKgFyqw0YA9EAjACZ0AT0FDkU5EA */
      types: {} as {
        context: TContext;
      },
      ...(jsonObj as any),
      context: ({ input }) => ({
        ...((jsonObj as any)?.context || {}),
        ...(input || {}),
      }),
    },
    {
      actions: {
        ...(options?.actions || {}),
        updateContext: assignEventDataToContext,
        updateLogs: assignLogsToContext,
      } as any,
      guards: options?.guards as any,
    },
  );

  return machine;
}
