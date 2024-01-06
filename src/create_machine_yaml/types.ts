import * as jsYaml from 'js-yaml';
import { EventObject } from 'xstate';

// Define a type for a generic event object.
export type GenericEventObject = EventObject & Record<string, any>;

// Define a type for a generic action function.
export type GenericActionFunction<TContext extends Record<string, any>> =
  (args: { context: TContext; event: GenericEventObject }) => void;

// Define a type for a generic guard function.
export type GenericGuardFunction<TContext extends Record<string, any>> =
  (args: { context: TContext; event: GenericEventObject }) => boolean;

/**
 * Options for creating a state machine from a YAML string.
 */
export interface CreateMachineYamlOptions<
  TContext extends Record<string, any>,
> {
  /**
   * Callback for handling YAML parsing warnings.
   * @param exception - The YAML parsing exception.
   */
  onWarningYamlParse?: (exception: jsYaml.YAMLException) => void;

  /**
   * Actions to be used in the state machine.
   */
  actions?: Record<string, GenericActionFunction<TContext>>;

  /**
   * Guards to be used in the state machine.
   */
  guards?: Record<string, GenericGuardFunction<TContext>>;
}
