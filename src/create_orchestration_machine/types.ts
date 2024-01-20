import { CloudEvent } from 'cloudevents';
import {
  MachineSnapshot,
  InternalMachineImplementations,
  AnyActor,
  AnyActorLogic,
} from 'xstate';
import { OnOrchestrationEvent, OnOrchestrationState } from '../cloud_orchestration_actor/types';

/**
 * Type representing possible states in an orchestration machine.
 */
export type OrchestrationStateType = 'parallel' | 'final';

/**
 * Type representing allowed string keys in orchestration machine configuration,
 * excluding keys 'emit' and 'transformer'.
 */
export type OrchestrationMachineAllowedStringKeys = Exclude<
  string,
  'emit' | 'transformer'
>;

/**
 * Configuration for an orchestration machine. This defines the machine. It is a subset of
 * xstate machines [XState Documentation](https://stately.ai/docs/machines).
 *
 * @example
 * ```typescript
 * // Example orchestration machine configuration:
 * const machineConfig: OrchestrationMachineConfig<MyContext> = {
 *   id: 'myOrchestrationMachine',
 *   context: { initialData: 'default' },
 *   initial: 'initialState',
 *   states: {
 *     initialState: { emit: 'startOrchestration' },
 *     subState1: { type: 'final', emit: 'finalizeState1' },
 *     subState2: { initial: 'nestedInitialState', entry: 'initializeNestedState', states: { nestedInitialState: { ... } } },
 *   },
 * };
 * ```
 */
export type OrchestrationMachineConfig<
  TContext extends Record<OrchestrationMachineAllowedStringKeys, any>,
> = {
  /**
   * The unique identifier for the orchestration machine. Used to distinguish between different machines.
   */
  id: string;
  /**
   * Initial context or a function to generate context based on input.
   * Represents the initial data or state of the orchestration machine.
   * It can be a static object or a function that dynamically generates the initial context based on the input parameters.
   */
  context?: TContext | ((params: { input: any }) => TContext);
  /**
   * Initial state if the state type is not 'parallel'.
   * Specifies the initial state that the orchestration machine enters when it is first instantiated.
   * Required if the machine is not of type 'parallel'.
   */
  initial?: string;
  /**
   * Type of the state machine, can be 'parallel'. If not specified it will be synchronous
   * For 'parallel' type, multiple states run together simultaneously.
   */
  type?: Exclude<OrchestrationStateType, 'final'>;
  /**
   * The states of the orchestration machine, defining its behavior and structure.
   * A dictionary where keys are state names and values are configurations for each state.
   * Each state configuration is of type `OrchestrationStateConfig`.
   */
  states: Record<
    OrchestrationMachineAllowedStringKeys,
    OrchestrationStateConfig
  >;
};

/**
 * Middleware function type for processing CloudEvents.
 * This function takes a CloudEvent and returns an object containing the event's type,
 * and optionally, additional event-specific data.
 *
 * @param event - The CloudEvent to be processed.
 * @returns An object containing the transformed data. This data
 * will upserted into the context.
 * @example
 * ```typescript
 * // Example middleware function for processing CloudEvents.
 * const onOrchestrationEvent: OnOrchestrationEvent = (event) => {
 *   return { bookId: event.data.bookId };
 *   // For pass through use `return event.data || {}`
 * };
 * ```
 */
export type OnOrchestrationEventTransformer = (
  event: CloudEvent<Record<OrchestrationMachineAllowedStringKeys, any>>,
) => Record<OrchestrationMachineAllowedStringKeys, any>;

/**
 * Configuration for transitioning between states in an orchestration machine.
 *
 * @example
 * ```typescript
 * // Example transition configuration:
 * const transitionConfig: OrchestrationTransitionConfig = {
 *   target: 'nextState',
 *   actions: ['notifyUser', 'updateStateData'],
 *   guard: 'isUserAuthorized',
 *   description: 'Transition triggered when a user is authorized to perform an action.',
 *   transformer: 'transformEventData',
 * };
 * ```
 */
export type OrchestrationTransitionConfig = {
  /**
   * The target state to transition to.
   */
  target: string;
  /**
   * Name(s) of the functions to execute when the event happens.
   *   Provide in the 'actions' key in the options of `createOrchestrationMachine`.
   *   These functions represent the behavior or side-effects to perform upon the event triggering the transition.
   */
  actions?: string | string[];
  /**
   * Guard statement to allow the transition only if true.
   * This statement acts as a condition that, when true, permits the execution of the transition's actions.
   * Refer to [Stately.ai Guards](https://stately.ai/docs/guards#multiple-guarded-transitions) for more information on guards.
   * It is defined in the `gruads` key of the options.
   */
  guard?: string;
  /**
   * Description of the transition, providing additional context or information about its purpose.
   * This can be helpful for documentation and understanding the intended behavior of the transition.
   */
  description?: string;
  /**
   * Transformer function name to execute before the event gets executed.
   * This function, if defined, allows for the transformation of data or preparation before the actual execution of the transition's actions.
   * It can be used to modify or adapt the event data before it is processed. It is defined in the `transformers` key of the options.
   */
  transformer?: string;
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
 * notif.orch.done. This is then converted to a CloudEvent to emit
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
export type OnOrchestrationStateEmit<
  TContext extends Record<OrchestrationMachineAllowedStringKeys, any>,
> = (
  id: string,
  state: string,
  snapshot: MachineSnapshot<TContext, any, any, any, any, any, any>,
) => {
  type: string;
  data: Record<OrchestrationMachineAllowedStringKeys, any>;
};

/**
 * Configuration for an orchestration machine state.
 *
 * @example
 * ```typescript
 * // Example state configuration:
 * const stateConfig: OrchestrationStateConfig = {
 *   type: 'parallel',
 *   emit: ['notifyUser', 'updateStateData'],
 *   onDone: { target: 'nextState' },
 *   states: {
 *     subState1: { type: 'final', emit: 'finalizeState1' },
 *     subState2: { },
 *   },
 * };
 * ```
 */
export type OrchestrationStateConfig = {
  /**
   * Type of the state, either 'parallel' or 'final'.
   * For 'parallel' type, multiple states run together simultaneously.
   * For 'final' type, the orchestration has ended.
   */
  type?: OrchestrationStateType;
  /**
   * Initial state if the state type is not 'parallel'.
   * Required if the state type is not 'parallel'.
   */
  initial?: string;
  /**
   * Name(s) of the functions to run when this state is reached.
   * Provided in the `emits` key in the options of `createOrchestrationMachine`.
   * These functions represent the behavior or side-effects to perform upon reaching this state.
   */
  emit?: string;
  /**
   * Name(s) of the functions to run when this state is entered.
   * Provided in the `actions` key in the options of `createOrchestrationMachine`.
   * These functions represent the behavior or side-effects to perform upon entering this state.
   */
  entry?: string | string[];
  /**
   * Name of the function to run when this state is exited.
   * Provided in the `actions` key in the options of `createOrchestrationMachine`.
   * These functions represent the behavior or side-effects to perform upon exiting this state.
   */
  exit?: string | string[];
  /**
   * Key-value pair of events accepted by this state, with corresponding transition configurations.
   * Defines the events that can trigger transitions from this state and the associated transition configurations.
   */
  on?: Record<
    OrchestrationMachineAllowedStringKeys,
    OrchestrationTransitionConfig | OrchestrationTransitionConfig[]
  >;
  /**
   * Target state to go to when all parallel states are done (applicable only for 'parallel' type).
   * Specifies the state to transition to when all parallel states under this state have completed their execution.
   */
  onDone?: { target: string };
  /**
   * Configuration for an abrupt state transition if this state is reached.
   * Defines a transition to be executed whenever this state is reached, regardless of the current event.
   */
  always?: OrchestrationTransitionConfig;
  /**
   * Description of the state, providing additional context or information about its purpose.
   * This can be helpful for documentation and understanding the intended behavior of the state.
   */
  description?: string;
  /**
   * Nested states for parallel or final states.
   * Allows defining sub-states for the 'parallel' or 'final' state, forming a hierarchical structure.
   */
  states?: Record<
    OrchestrationMachineAllowedStringKeys,
    OrchestrationStateConfig
  >;
};

/**
 * Options configuration for creating an orchestration machine.
 *
 * @example
 * ```typescript
 * // Example machine options configuration:
 * const machineOptions: CreateOrchestrationMachineOptions<MyContext> = {
 *   emits: {
 *     initialState: (id, state, snapshot) => ({ type: 'evt.state.entered', data: { id, state, snapshot } }),
 *     finalState: (id, state, snapshot) => ({ type: 'evt.orchestration.completed', data: { id, state, snapshot } }),
 *   },
 *   transformers: {
 *     'evt.user.action': (event) => ({ transformedData: event.data.userAction }),
 *   },
 *   actions: {}, // See more information on Actions: [XState Actions](https://stately.ai/docs/actions)
 *   gruads: {}, // See more information on Guards: [XState Guards](https://stately.ai/docs/guards)
 * };
 * ```
 */
export type CreateOrchestrationMachineOptions<
  TContext extends Record<OrchestrationMachineAllowedStringKeys, any>,
> = {
  /**
   * Dictionary containing functions to emit CloudEvent data for each state.
   * Defines the functions responsible for creating CloudEvents when transitioning to specific states.
   * The keys in this dictionary correspond to state names, and the values are functions of type `OnOrchestrationStateEmit`.
   */
  emits?: Record<
    OrchestrationMachineAllowedStringKeys,
    OnOrchestrationStateEmit<TContext>
  >;
  /**
   * Dictionary containing transformers for CloudEvent data when events are received.
   * Defines functions responsible for transforming CloudEvent data upon receiving events.
   * The keys in this dictionary correspond to event types, and the values are functions of type `OnOrchestrationEventTransformer`.
   */
  transformers?: Record<
    OrchestrationMachineAllowedStringKeys,
    OnOrchestrationEventTransformer
  >;
  /**
   * See more information on Actions: [XState Actions](https://stately.ai/docs/actions)
   */
  actions?: InternalMachineImplementations<TContext, any>['actions'];
  /**
   * See more information on Guards: [XState Guards](https://stately.ai/docs/guards)
   */
  guards?: InternalMachineImplementations<TContext, any>['guards'];
};

/**
 * Represents the output of the `createOrchestrationMachine` function.
 * This type encapsulates the machine created by xstate's `createMachine` function,
 * along with additional configurations for handling orchestration events and states.
 *
 * @typeparam TLogic - The type of logic associated with the orchestration actor.
 */
export type OrchestrationMachine<TLogic extends AnyActorLogic> = {
  /**
   * The machine created by xstate's `createMachine`. It can be
   * used in any xstate-compatible actor for execution.
   */
  machine: TLogic;
  /**
   * A key-value map where the keys are event names,
   * and the values are corresponding transformation functions.
   * These functions are executed after receiving an event but before
   * the event is ingested by the machine.
   */
  onOrchestrationEvent: Record<string, OnOrchestrationEvent>;
  /**
   * A key-value pair that instructs the orchestration actor to
   * emit an event when a certain state is reached.
   */
  onOrchestrationState: Record<string, OnOrchestrationState>;
};
