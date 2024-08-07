import { generateShortUuid } from './utils';
import { BasicContext, BasicEventObject } from './types';

type GuardParams<
  TContext extends Record<string, any>,
  TEventData extends Record<string, any>,
> = {
  name: string;
  handler: (params: {
    event: BasicEventObject<TEventData>;
    context: BasicContext<TContext>;
  }) => boolean;
};

/**
 *
 * Represents a condition (guard) within a state machine context using XState. Guards in XState are
 * boolean-returning functions that determine the feasibility of a transition or action based on
 * current state conditions. This `Guard` class allows for defining such conditions with a name and a
 * unique identifier, enhancing traceability and management within complex state machines.
 *
 * Guards are especially useful in scenarios where transitions need to be contingent upon dynamic
 * conditions within the state context or external factors.
 *
 * Example usage:
 * ```typescript
 * const guard = new Guard<MyContext>((snapshot) => {
 *   return snapshot.context.data.isValid;  // Condition based on the context data
 * }, 'validateUser');
 * console.log(guard.ref);  // Outputs the unique ID of the guard, incorporating the name 'validateUser'
 * ```
 *
 * @typeparam TContext The type of the state context within which the action operates.
 * @typeparam TEventData The type of the event within which the action operates.
 */
export default class Guard<
  TContext extends Record<string, any> = Record<string, any>,
  TEventData extends Record<string, any> = Record<string, any>,
> {
  private id: string;
  private params: GuardParams<TContext, TEventData>;

  /**
   * Initializes a new instance of the `Guard` class with a specified name and a boolean-returning handler function.
   * The handler function evaluates the state conditions and determines whether a specific transition or action
   * can be performed based on the current state captured in a `MachineSnapshot`.
   *
   * @param params An object containing:
   *  - `name`: A string to name the guard. This name is incorporated into the guard's unique identifier.
   *  - `handler`: A function that defines the logic for the guard's condition. It takes a `MachineSnapshot` of
   *    the current state and returns a boolean indicating whether the conditions are met for the action or transition to proceed.
   */
  constructor(
    params:
      | GuardParams<TContext, TEventData>
      | ((params: {
          event: BasicEventObject<TEventData>;
          context: BasicContext<TContext>;
        }) => boolean),
  ) {
    if (typeof params === 'function') {
      this.params = {
        name: generateShortUuid(),
        handler: params,
      };
    } else {
      this.params = params;
    }
    this.id = this.params.name;
  }

  /**
   * The unique identifier of the guard, facilitating easy identification and reference.
   */
  public get ref() {
    return this.id;
  }

  /**
   * The function that evaluates the guard condition, returning true if the condition is met,
   * otherwise false.
   */
  public get handler() {
    return this.params.handler;
  }
}
