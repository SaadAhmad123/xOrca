import { OrchestrationTransitionConfig } from '../types';
import Action from './action';
import * as zod from 'zod';
import { BasicContext, GuardedTransitionV3 } from './types';
import { withBasicActions } from './basic_actions';

/**
 * Manages state transitions within a state machine, allowing configuration of transition conditions, actions, and targets.
 * This class enables defining multiple guarded and unguarded transitions for a single event, providing robust control
 * over state changes based on complex conditions.
 *
 * @typeparam TContext Defines the context type for the state machine, describing the state's structure.
 * @typeparam TEventData Defines the structure of the event data relevant to the transition, validated by a Zod schema.
 */
export default class Transition<
  TContext extends Record<string, any>,
  TEventData extends zod.ZodObject<any> = any,
> {
  private guards: GuardedTransitionV3<TContext>[] = [];
  private params: {
    on: string;
    target: string;
    schema?: TEventData;
    actions?: Action<TContext>[];
    description?: string;
  };

  /**
   * Constructs a Transition instance with basic transition parameters.
   *
   * @param on Event name triggering the transition.
   * @param config Configuration object for the transition:
   *  - `target`: The state machine's target state for this transition.
   *  - `schema`: Optional Zod schema to validate the event data.
   *  - `actions`: Optional array of actions to perform during the transition. Default is all the actions provided by withBasicActions()
   *  - `description`: Optional description of the transition's purpose and functionality.
   */
  constructor(
    on: string,
    config: {
      target: string;
      schema?: TEventData;
      actions?: Action<TContext>[];
      description?: string;
    },
  ) {
    this.params = {
      on,
      ...config,
      actions: config.actions || withBasicActions(),
    };
  }

  /**
   * Adds a guarded transition configuration to this transition instance.
   *
   * @param guard A GuardedTransition configuration linking guards to actions and target states.
   */
  public guard(guard: GuardedTransitionV3<TContext>) {
    this.guards.push(guard);
    return this;
  }

  /**
   * Retrieves the reference key for this transition, typically the event name that triggers it.
   *
   * @returns The event name as a string.
   */
  public get ref() {
    return this.params.on;
  }

  /**
   * Compiles and retrieves all the transition configurations for this instance, including both guarded and unguarded transitions.
   *
   * @returns An array of OrchestrationTransitionConfig objects representing each configured transition.
   */
  public get handler(): OrchestrationTransitionConfig[] {
    return [
      ...this.guards.map((item) => ({
        guard: item.guard.ref,
        actions: (item.actions || []).map((action) => action.ref),
        description: item.description,
        target: item.target,
      })),
      {
        target: this.params.target,
        eventSchema: this.params.schema
          ? {
              type: this.params.on,
              data: this.params.schema,
            }
          : undefined,
        description: this.params.description,
        actions: (this.params.actions || []).map((action) => action.ref),
      },
    ];
  }

  /**
   * Consolidates and returns a map of all action functions across both guarded and unguarded transitions.
   *
   * @returns A map where keys are action references and values are the corresponding action handler functions.
   */
  public get actionFunctions() {
    return Object.assign(
      {},
      ...[
        ...(this.params.actions || []),
        ...this.guards.reduce(
          (acc, cur) => [...acc, ...(cur?.actions || [])],
          [] as Action<TContext>[],
        ),
      ].map((item) => ({ [item.ref]: item.handler })),
    );
  }

  /**
   * Consolidates and returns a map of all guard functions for this transition.
   *
   * @returns A map where keys are guard references and values are the corresponding guard condition functions.
   */
  public get guardFunctions() {
    return Object.assign(
      {},
      ...this.guards.map((item) => ({ [item.guard.ref]: item.guard.handler })),
    );
  }
}
