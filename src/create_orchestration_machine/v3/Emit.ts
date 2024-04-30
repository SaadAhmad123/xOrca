import { OnOrchestrationStateEmit } from '../types';
import * as zod from 'zod';
import { MachineSnapshot } from 'xstate';
import { generateShortUuid } from './utils';

/**
 * `Emit` class facilitates the creation and management of typed events within a state machine.
 * It enables events to carry strongly-typed names and data, validated via Zod schemas, and handled by
 * a custom function. It is ideal for complex state management scenarios where events must adhere
 * to specific data structures and behaviors.
 *
 * Example usage:
 * ```typescript
 * const emitter = new Emit({
 *   name: 'cmd.book.fetch',
 *   schema: zod.object({
 *     name: zod.string(),
 *     age: zod.number(),
 *   }),
 *   handler: (id, state, snapshot) => ({
 *     name: 'book_name_1',
 *     age: 150
 *   })
 * });
 * console.log(emitter.ref); // Outputs the unique ID of the emitter
 * ```
 *
 * @typeparam TContext The context type of the state machine, typically a record or an object describing the state.
 * @typeparam TEmit A string literal type that specifies the unique name of the event.
 * @typeparam TEmitData The type defining the structure of the data associated with the event, enforced by a Zod schema.
 */
export default class Emit<
  TContext extends Record<string, any>,
  TEmit extends string,
  TEmitData extends zod.ZodObject<any>,
> {
  /**
   * Creates a new `Emit` instance with a new unique identifier while maintaining the same configuration.
   * This method is useful when the event configuration needs to be reused with a new identity,
   * ensuring that event handling remains consistent across different instances.
   *
   * @param emit The existing `Emit` instance to clone.
   * @returns A new `Emit` instance with identical configuration but a different unique identifier.
   */
  static copyFrom<
    TContext extends Record<string, any>,
    TEmit extends string,
    TEmitData extends zod.ZodObject<any>,
  >(emit: Emit<TContext, TEmit, TEmitData>): Emit<TContext, TEmit, TEmitData> {
    const newEmit = new Emit<TContext, TEmit, TEmitData>({ ...emit.params });
    return newEmit;
  }

  private id: string;

  /**
   * Initializes a new instance of the `Emit` class configured for event handling.
   *
   * @param params An object containing the necessary configurations:
   *  - `name`: The name of the event, which is included in the unique identifier.
   *  - `schema`: A Zod schema to validate the event's data structure.
   *  - `handler`: A function that processes the event using the provided state context and a snapshot
   *    of the state machine, returning data that matches the defined schema.
   */
  constructor(
    private params: {
      name: TEmit;
      schema: TEmitData;
      handler: (
        id: string,
        state: string,
        snapshot: MachineSnapshot<TContext, any, any, any, any, any, any>,
      ) => zod.infer<TEmitData>;
    },
  ) {
    this.id = `${this.params.name}_${generateShortUuid()}`;
  }

  /**
   * Provides the unique identifier for this event emitter instance. This identifier is a composite
   * of the event name and a UUID.
   *
   * @returns A string that represents the unique identifier of this instance.
   */
  public get ref(): string {
    return this.id;
  }

  /**
   * Accesses the handler function for this event. This function encapsulates the event logic as defined
   * during instantiation. It ensures the event data adheres to the schema before returning it, enhancing
   * data integrity and error handling.
   *
   * @throws Throws an error if the data returned by the handler does not conform to the schema.
   * @returns A function that, when executed, processes the event using the defined handler,
   *          returning an object with 'type' and 'data' reflecting the event's outcome.
   */
  public get handler(): OnOrchestrationStateEmit<TContext, TEmit> {
    return (...args) => {
      const data = this.params.handler(...args);
      this.params.schema.parse(data); // Validates the data against the schema
      return {
        type: this.params.name,
        data,
      };
    };
  }

  public get schema(): zod.ZodObject<any> {
    return this.params.schema;
  }
}
