import { CloudEvent } from 'cloudevents';
import {
  AnyMachineSnapshot,
  AnyActorLogic,
  ActorOptions,
  InspectionEvent,
} from 'xstate';

/**
 * Represents the version of a state machine in the format '{number}.{number}.{number}'.
 * @example
 * // Example state machine version.
 * type ExampleVersion = '1.0.0';
 */

export type Version = `${number}.${number}.${number}`;
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

export type CloudOrchestrationMiddlewares = {
  /**
   * A record mapping event types to middleware functions for processing CloudEvents.
   * When a CloudEvent occurs (e.g., `Instance<CloudOrchestrationActor>.cloudevent(Instance<CloudEvent>)`),
   * the registered function is invoked, transforming and returning data. Use this to convert CloudEvent data
   * for merging or upserting into the orchestrator's context.
   */
  onOrchestrationEvent?: Record<string, OnOrchestrationEvent>;

  /**
   * A record mapping event types to middleware functions for handling orchestration based on state and snapshot.
   * This is used to emit a CloudEvent when a specified state is reached. The onState function is called upon state
   * attainment, and the returned object constructs a CloudEvent. Access these events using `Instance<CloudOrchestrationActor>.eventsToEmit`.
   */
  onOrchestrationState?: Record<string, OnOrchestrationState>;
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
    middleware?: CloudOrchestrationMiddlewares;

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
