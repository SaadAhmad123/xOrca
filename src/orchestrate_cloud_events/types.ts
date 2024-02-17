import { ILockableStorageManager } from 'unified-serverless-storage';
import { AnyActorLogic, SnapshotFrom, ContextFrom } from 'xstate';
import { Version } from '../cloud_orchestration_actor/types';
import { OrchestrationMachine } from '../create_orchestration_machine/types';

/**
 * Represents a  orchestration state machine configuration, including its version and logic.
 *
 * @template TLogic - The type of logic governing the behavior of the state machine.
 */

export type OrchestrationMachineWithVersion<TLogic extends AnyActorLogic> = {
  /**
   * The version of the state machine logic. Should follow the format '{number}.{number}.{number}'.
   * @example
   * // Example state machine version.
   * version: '1.0.0'
   */
  version: Version;

  /**
   * The orchestration state machine logic associated with the specified version.
   * Create this machine via `createOrchestrationMachine`
   */
  orchestrationMachine: OrchestrationMachine<TLogic>;
};
/**
 * Interface for orchestrating cloud events using a specified state machine and storage manager.
 * Allows the definition of custom responses to cloud events and orchestration states,
 * and specifies locking mechanisms for storage operations.
 *
 * @template TLogic - The type of logic governing the behavior of the orchestration.
 */

export interface IOrchestrateCloudEvents<TLogic extends AnyActorLogic> {
  /**
   * The orchestrator's project-wide unique name, providing a distinctive identifier within the project context.
   * @example
   * // Example orchestrator name.
   * name: "summary"
   */
  name: string;

  /**
   * The state machine logic that governs the behavior of the orchestration.
   * It must be a list of state machine logics with their corresponding versions
   */
  statemachine: OrchestrationMachineWithVersion<TLogic>[];

  /**
   * The storage manager responsible for persisting the state of the orchestration.
   * Should implement the ILockableStorageManager interface for concurrent access control.
   * This is governed by the npm package `unified-serverless-storage` [see here](https://www.npmjs.com/package/unified-serverless-storage#usage-example).
   * @example
   * // Example storage manager implementation.
   * storageManager: myLockableStorageManager
   */
  storageManager: ILockableStorageManager;

  /**
   * Specifies the locking mode for the storage manager's operations.
   * - "write": Locks are acquired during write operations.
   * - "read-write": Locks are acquired during both read and write operations.
   * @example
   * // Example locking mode configuration.
   * locking?: 'write' | 'read-write';
   */
  locking?: 'write' | 'read-write';

  /**
   * Function called on snapshot, providing the process ID and the emitted snapshot.
   * @param processId - The process ID of the orchestration process.
   * @param snapshot - The emitted snapshot capturing the current state of the orchestration.
   * @returns void
   * @example
   * // Example onSnapshot function.
   * onSnapshot?: (processId: string, snapshot: SnapshotFrom<TLogic>) => {
   *   console.log(`Snapshot received for process ${processId}:`, snapshot);
   * };
   */
  onSnapshot?: (processId: string, snapshot: SnapshotFrom<TLogic>) => void;
}
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
