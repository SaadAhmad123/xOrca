import { ActionFunction, EventObject } from 'xstate';
import { v4 as uuidv4 } from 'uuid';

/**
 * A generic class for defining actions within an XState state machine context. It encapsulates
 * action logic and associates it with a unique identifier. Actions defined using this class can
 * be used for handling state transitions or performing side effects in response to events in the state machine.
 *
 * Example usage:
 * ```typescript
 * const action = new Action<MyContext>((context, event) => {
 *   console.log('Action executed', context, event);
 * }, 'saveData');
 * console.log(action.ref);  // Outputs the unique ID of the action, incorporating the name 'saveData'
 * ```
 *
 * @typeparam TContext The type of the state context within which the action operates.
 */
export default class Action<TContext extends Record<string, any>> {
  /**
   * Clones an existing `Action` instance, creating a new instance with the same parameters but a new unique identifier.
   *
   * @param action The `Action` instance to clone.
   * @returns A new `Action` instance that is a copy of the input but with a unique identifier.
   */
  static copyFrom<TContext extends Record<string, any>>(
    action: Action<TContext>,
  ) {
    return new Action<TContext>(action.params);
  }

  private id: string;

  /**
   * Initializes a new instance of the `Action` class with a specified name and handler function.
   *
   * @param params An object containing:
   * - `name`: A string to name the action. This name is incorporated into the action's unique identifier.
   * - `handler`: An ActionFunction from XState designed to execute based on the current machine context and the event that triggered the action.
   */
  constructor(
    private params: {
      name: string;
      handler: ActionFunction<
        TContext,
        EventObject & { [key: string]: any },
        EventObject & { [key: string]: any },
        any,
        any,
        any,
        any,
        any
      >;
    },
  ) {
    this.id = `action_${this.params.name}_${uuidv4()}`;
  }

  /**
   * Provides the unique identifier of this action instance. The identifier includes the action's name
   * and a UUID, enhancing traceability and uniqueness within a state machine.
   *
   * @returns A string that serves as the unique identifier of this action instance.
   */
  public get ref() {
    return this.id;
  }

  /**
   * Accesses the handler function defined for this action. This function is invoked by the state machine
   * to perform the action's logic, taking into account the current context and the triggering event.
   *
   * @returns The ActionFunction configured during the creation of this instance, which processes the state
   *          and event to perform the specified action.
   */
  public get handler() {
    return this.params.handler;
  }
}
