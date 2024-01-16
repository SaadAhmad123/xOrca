import {
  ContextFrom,
  Actor,
  ActorOptions,
  AnyActorLogic,
  AnyMachineSnapshot,
  InspectionEvent,
  Snapshot,
  SnapshotFrom,
} from 'xstate';
import { CloudEvent } from 'cloudevents';
import { ILockableStorageManager } from 'unified-serverless-storage';

/**
 * Represents the version of a state machine in the format '{number}.{number}.{number}'.
 * @example
 * // Example state machine version.
 * type ExampleVersion = '1.0.0';
 */
export type Version = `${number}.${number}.${number}`;

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
 * Middleware function type for processing CloudEvents.
 * This function takes a CloudEvent and returns an object containing the event's type,
 * and optionally, additional event-specific data.
 *
 * @param event - The CloudEvent to be processed.
 * @returns An object containing the type of the event, and optionally, additional data. The
 * type ideally must be the topic of the event e.g. cmd.books.fetch, evt.books.fetch.success,
 * notif.orch.done
 * @example
 * ```typescript
 * // Example middleware function for processing CloudEvents.
 * const onOrchestrationEvent: OnOrchestrationEvent = (event) => {
 *   return {
 *     type: 'cmd.books.fetch',
 *     data: { bookId: event.data.bookId },
 *   };
 * };
 * ```
 */
export type OnOrchestrationEvent = (event: CloudEvent<Record<string, any>>) => {
  type: string;
  data?: Record<string, any>;
};

/**
 * Middleware function type for handling orchestration logic based on state and snapshot data.
 * This function takes the current state and a machine snapshot, and returns data to create a CloudEvent representing
 * the necessary actions or information for cloud-based orchestration.
 *
 * @param id - The unique identifier for the orchestration actor.
 * @param state - The current state of the machine.
 * @param snapshot - The snapshot of the machine, providing a detailed view of its current state.
 * @returns An object containing the type of the event, and optionally, additional data. The
 * type ideally must be the topic of the event e.g. cmd.books.fetch, evt.books.fetch.success,
 * notif.orch.done
 * @example
 * ```typescript
 * // Example middleware function for handling orchestration based on state and snapshot.
 * const onOrchestrationState: OnOrchestrationState = (id, state, snapshot) => {
 *   return {
 *     type: 'evt.books.fetch.success',
 *     data: { orchestrationId: id, status: 'completed', snapshot },
 *   };
 * };
 * ```
 */
export type OnOrchestrationState = (
  id: string,
  state: string,
  snapshot: AnyMachineSnapshot,
) => {
  type: string;
  data?: Record<string, any>;
};

/**
 * Interface defining middleware options for a Cloud Orchestration Actor, facilitating customization of event processing and orchestration logic.
 * It includes two optional properties: 'onCloudEvent' and 'onState', each mapping event types to their respective middleware functions.
 *
 * @example
 * ```typescript
 * // Example middleware options for a cloud orchestrator.
 * const middlewareOptions: CloudOrchestratorMiddlewares = {
 *   onCloudEvent: {
 *     'evt.books.fetch.success': (event) => ({
 *        type: event.type,
 *        data: {
 *          // Transforming CloudEvent data
 *          content: event.data.content.join(' ')
 *        }
 *      }),
 *   },
 *   onState: {
 *     'fetch_book': (id, state, { context }) => ({
 *        type: 'cmd.books.fetch',
 *        data: { book_id: "some-book.pdf"}
 *      }),
 *     // Nested states
 *     '#regulation.#grounded.check': (id, state, snapshot) => ({...}),
 *     '#regulation.#compliance.check': (id, state, snapshot) => ({...}),
 *   },
 * };
 * ```
 */
export type CloudOrchestratorMiddlewares = {
  /**
   * A record mapping event types to middleware functions for processing CloudEvents.
   * When a CloudEvent occurs (e.g., `Instance<CloudOrchestrationActor>.cloudevent(Instance<CloudEvent>)`),
   * the registered function is invoked, transforming and returning data. Use this to convert CloudEvent data
   * for merging or upserting into the orchestrator's context.
   */
  onCloudEvent?: Record<string, OnOrchestrationEvent>;

  /**
   * A record mapping event types to middleware functions for handling orchestration based on state and snapshot.
   * This is used to emit a CloudEvent when a specified state is reached. The onState function is called upon state
   * attainment, and the returned object constructs a CloudEvent. Access these events using `Instance<CloudOrchestrationActor>.eventsToEmit`.
   */
  onState?: Record<string, OnOrchestrationState>;
};

/**
 * Configuration options tailored for a CloudOrchestrationActor, extending the base ActorOptions with cloud-specific features.
 * These options provide enhanced capabilities for inspection event handling and middleware integration,
 * making the actor well-suited for cloud-based scenarios.
 */
export type CloudOrchestrationActorOptions<TLogic extends AnyActorLogic> =
  ActorOptions<TLogic> & {
    /**
     * An optional callback function to handle inspection events. This function is useful for debugging,
     * monitoring, or applying custom processing to inspection events, thereby improving the actor's observability.
     * @param evt - The inspection event to be handled.
     */
    inspect?: (evt: InspectionEvent) => void;

    /**
     * An optional object specifying middleware for use with the actor.
     * This middleware enables customized handling of cloud events and orchestration logic,
     * facilitating the implementation of intricate scenarios in cloud-based applications.
     */
    middleware?: CloudOrchestratorMiddlewares;

    /**
     * The version of the state machine responsible for orchestration.
     * Must be in the format `{number}.{number}.{number}`, set by the developer to denote the state machine version.
     */
    version: Version;

    /**
     * Unique identifier for the orchestrator actor, crucial for tracking and managing the state of each orchestration instance.
     * This ID differentiates between multiple instances and serves as a key component in orchestrating cloud-based processes.
     */
    id: string;

    /**
     * The orchestrator's project-wide unique name, such as "SummaryStateMachine".
     * This name provides a distinctive identifier for the orchestrator within the project context.
     */
    name: string;
  };

/**
 * Represents a state machine configuration, including its version and logic.
 *
 * @template TLogic - The type of logic governing the behavior of the state machine.
 */
export type StateMachineWithVersion<TLogic extends AnyActorLogic> = {
  /**
   * The version of the state machine logic. Should follow the format '{number}.{number}.{number}'.
   * @example
   * // Example state machine version.
   * version: '1.0.0'
   */
  version: Version;

  /**
   * The state machine logic associated with the specified version.
   * See xstate [documentation](https://stately.ai/docs/machines#creating-a-state-machine)
   * @example
   * // Example state machine logic.
   * logic: createMachine({})
   *        // or createMachineYaml() - Refer to persisted-xstate-actor documentation.
   */
  logic: TLogic;
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
   * name: "SummaryStateMachine"
   */
  name: string;

  /**
   * The state machine logic that governs the behavior of the orchestration.
   * It must be a list of state machine logics with their corresponding versions
   * @example
   * // Example state machine configuration.
   * statemachine: [{
   *   version: '1.0.0',
   *   logic: createMachine({}) // See xstate [documentation](https://stately.ai/docs/machines#creating-a-state-machine)
   * }]
   */
  statemachine: StateMachineWithVersion<TLogic>[];

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
   * A record mapping event types to middleware functions for processing CloudEvents.
   * Invoked when a CloudEvent occurs, transforming and returning data for merging or upserting into the orchestrator's context.
   * @example
   * // Example onCloudEvent configuration.
   * onCloudEvent?: Record<string, OnOrchestrationEvent> = {
   *   'evt.books.fetch.success': (event) => ({
   *     type: event.type,
   *     data: {
   *       // Transforming CloudEvent data
   *       content: event.data.content.join(' ')
   *     }
   *   }),
   * }
   */
  onCloudEvent?: Record<string, OnOrchestrationEvent>;

  /**
   * A record mapping event types to middleware functions for handling orchestration based on state and snapshot.
   * Used to emit a CloudEvent when a specified state is reached. The onState function is called upon state attainment,
   * and the returned object constructs a CloudEvent. Access these events using `Instance<CloudOrchestrationActor>.eventsToEmit`.
   * @example
   * // Example onOrchestrationState configuration.
   * onOrchestrationState?: Record<string, OnOrchestrationState> = {
   *   'fetch_book': (id, state, { context }) => ({
   *     type: 'cmd.books.fetch',
   *     data: { book_id: "some-book.pdf"}
   *   }),
   *   // Nested states
   *   '#regulation.#grounded.check': (id, state, snapshot)
   *     => ({...}),
   *   '#regulation.#compliance.check': (id, state, snapshot) => ({...}),
   * }
   */
  onOrchestrationState?: Record<string, OnOrchestrationState>;

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
   * The process ID of the orchestration.
   * @example
   * // Example process ID.
   * processId: "abc123"
   */
  processId: string;

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
