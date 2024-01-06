import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  AnyMachineSnapshot,
  ContextFrom,
  InspectionEvent,
  Snapshot,
  SnapshotFrom,
} from 'xstate';
import { CloudEvent } from 'cloudevents';
import { ILockableStorageManager } from 'unified-serverless-storage';
import { inspect } from 'util';

/**
 * Defines the structure for the input parameters required by the withPersistance function.
 * This interface is crucial for setting up a persistent actor in an XState context,
 * providing necessary details like identification, storage management, and actor creation logic.
 */
export type PersistableActorInput<
  TLogic extends AnyActorLogic,
  TActor extends Actor<TLogic>,
> = {
  /**
   * The unique identifier for the actor. This ID is used to differentiate between
   * multiple instances and is crucial for tracking and managing the state of each actor.
   */
  id: string;

  /**
   * The storage manager responsible for persisting the actor's state.
   * It should implement the ILockableStorageManager interface, which allows for reading and writing
   * data to a storage medium, with optional locking mechanisms for concurrent access control.
   */
  storageManager: ILockableStorageManager;

  /**
   * A factory function that creates an instance of the actor.
   * @param id - The unique identifier of the actor.
   * @param snapshot - An optional parameter that provides a previously persisted snapshot
   *                   of the actor's state, allowing for state restoration.
   */
  actorCreator: (id: string, snapshot?: Snapshot<unknown>) => TActor;

  /**
   * Specifies the locking mode for the actor's persistence operations.
   * - "write": Locks are only acquired during write operations.
   * - "read-write": Locks are acquired during both read and write operations.
   * This parameter is optional. If omitted, no locking mechanism is applied to the operations.
   */
  locking?: 'write' | 'read-write';

  /**
   * The maximum timeout in milliseconds for acquiring a lock.
   * This is an optional parameter that sets a limit on how long the system should wait
   * to acquire a lock before timing out. It's used in conjunction with the locking mechanism.
   */
  acquireLockMaxTimeout?: number;
};

/**
 * Type definition for middleware that processes CloudEvents.
 * This middleware function takes a CloudEvent and returns an object containing the event's type,
 * and optionally, additional event-specific data.
 *
 * @param event - The CloudEvent to be processed.
 * @returns An object containing the type of the event, and optionally, additional data.
 */
export type CloudEventMiddleware = (event: CloudEvent<Record<string, any>>) => {
  type: string;
  data?: Record<string, any>;
};

/**
 * Type definition for middleware that handles orchestration logic based on state and snapshot data.
 * This function takes the current state and a machine snapshot, and returns a CloudEvent representing
 * the necessary actions or information for cloud-based orchestration.
 *
 * @param state - The current state of the machine.
 * @param snapshot - The snapshot of the machine, providing a detailed view of its current state.
 * @returns A CloudEvent tailored for cloud orchestration based on the given state and snapshot.
 */
export type CloudOrchestrationStateMiddleware = (
  id: string,
  state: string,
  snapshot: AnyMachineSnapshot,
) => CloudEvent<Record<string, any>>;

/**
 * Interface defining the structure of middleware options for a cloud orchestrator.
 * It consists of two optional properties: 'cloudevent' and 'orchestration', which are records
 * mapping event types to their respective middleware functions for cloud event processing and orchestration.
 */
export type CloudOrchestratorMiddlewares = {
  cloudevent?: Record<string, CloudEventMiddleware>;
  orchestration?: Record<string, CloudOrchestrationStateMiddleware>;
};

/**
 * Type extending ActorOptions to include specific configurations for a CloudOrchestrationActor.
 * This type adds optional properties for inspection event handling and middleware integration,
 * enhancing the actor's capabilities in a cloud context.
 */
export type CloudOrchestrationActorOptions<TLogic extends AnyActorLogic> =
  ActorOptions<TLogic> & {
    /**
     * An optional function for handling inspection events. This function can be used for debugging,
     * monitoring, or custom processing of inspection events, enhancing the observability of the actor.
     */
    inspect?: (evt: InspectionEvent) => void;
    /**
     * An optional object specifying the middleware to be used with the actor.
     * This middleware allows for customized handling of cloud events and orchestration logic,
     * enabling complex scenarios in cloud-based applications.
     */
    middleware?: CloudOrchestratorMiddlewares;

    /**
     * State machine version.
     */
    version: `${number}.${number}.${number}`;

    /**
     * Id of the state machine
     */
    id: string;
  };

/**
 * Interface for orchestrating cloud events using a specified state machine and storage manager.
 * It allows defining custom responses to cloud events and orchestration states, and specifies locking mechanisms for storage operations.
 */
export interface IOrchestrateCloudEvents<TLogic extends AnyActorLogic> {
  /**
   * The state machine logic that governs the behavior of the orchestration.
   */
  statemachine: {
    version: `${number}.${number}.${number}`;
    logic: TLogic;
  };

  /**
   * The storage manager responsible for persisting the state of the orchestration.
   * It should implement the ILockableStorageManager interface, enabling reading and writing data with concurrent access control.
   */
  storageManager: ILockableStorageManager;

  /**
   * A record mapping cloud event types to middleware functions. These functions are called when a cloud event is received,
   * allowing custom processing based on the event type.
   */
  onCloudEvent?: Record<string, CloudEventMiddleware>;

  /**
   * A record mapping state names to orchestration middleware functions. These functions are called when a specific state is reached.
   * States are represented by their names, with nested states separated by dots (e.g., 'state1.state2').
   * The middleware function should return an orchestration command that will be dispatched.
   */
  onOrchestrationState?: Record<string, CloudOrchestrationStateMiddleware>;

  /**
   * Specifies the locking mode for the storage manager's operations.
   * - "read": Locks are acquired during read operations.
   * - "read-write": Locks are acquired during both read and write operations.
   */
  locking?: 'read' | 'read-write';

  /**
   * Function called on snapshot
   * @param processId - the process id of the process
   * @param snapshot - the snapshot which is emitted
   * @returns
   */
  onSnapshot?: (processId: string, snapshot: SnapshotFrom<TLogic>) => void;
}
