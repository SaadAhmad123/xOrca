import { AnyActorLogic, ContextFrom } from 'xstate';
import { Version } from '../cloud_orchestration_actor/types';

/**
 * Represents the event required to initialize an orchestration.
 *
 * @template TLogic - The type of logic governing the behavior of the orchestration.
 */
export type InitialOrchestrationEvent<TLogic extends AnyActorLogic> = {
  /**
   * The process ID seed of the orchestration.
   * @example
   * // Example process ID.
   * processId: "abc123"
   */
  processId?: string;

  /**
   * The initial data seeded to the orchestration context.
   * @example
   * // Example initial context data.
   * context: { bookId: "some-book.pdf", status: "pending" }
   */
  context: ContextFrom<TLogic>;

  /**
   * The version for the orchestration. If not provided, the latest version will be used.
   * The version must be of format '{number}.{number}.{number}'
   * @example
   * // Example version specification.
   * version: '1.0.0'
   */
  version?: Version;
};
