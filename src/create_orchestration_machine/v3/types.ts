import { CloudEvent } from 'cloudevents';
import { OrchestrationStateType } from '../types';
import Action from './action';
import Emit from './emit';
import Guard from './guard';
import Transition from './transition';
import * as zod from 'zod';

/**
 * Defines the configuration for an orchestration state machine including states, transitions,
 * actions, and contextual data.
 *
 * @typeparam TContext The type of context for the state machine, typically a record or an object that
 *                     describes the state's structure and data.
 * @typeparam TState A string union representing all possible state identifiers within the machine.
 * @typeparam TInput The type for the input data that initializes or influences the state context.
 */
export type OrchestrationMachineConfigV3<
  TContext extends Record<string, any>,
  TState extends string = string,
  TInput extends Record<string, any> = Record<string, any>,
> = {
  /**
   * Unique identifier for the orchestration machine. Used to distinguish between different instances or types of machines.
   */
  id: string;
  /**
   * Optional description providing additional context or information about the orchestration machine's purpose.
   */
  description?: string;
  /**
   * Represents the initial data or state context of the machine, either as a static object or as a function that
   * dynamically generates the context based on input parameters.
   */
  context?: (params: { input: TInput }) => TContext;
  /**
   * Specifies the initial state that the machine should enter upon instantiation.
   * This property is required unless the machine's type is 'parallel', which supports multiple concurrent initial states.
   */
  initial?: TState;
  /**
   * Defines the type of state machine, which can be 'parallel' to indicate simultaneous execution of states.
   * If unspecified, it defaults to a standard, synchronous state machine type.
   */
  type?: Exclude<OrchestrationStateType, 'final'>;
  /**
   * Maps state identifiers to their corresponding configurations, detailing the behavior and structure of each state.
   */
  states: Record<TState, OrchestrationStateConfigV3<TContext, string>>;
};

/**
 * Configures individual states within an orchestration machine, specifying state type, transitions,
 * actions, and nested states.
 *
 * @typeparam TContext The context type of the state machine, defining the shape of data available during state transitions.
 * @typeparam TState A string type for state identifiers, typically used for nesting states or referencing target states.
 */
export type OrchestrationStateConfigV3<
  TContext extends Record<string, any>,
  TState extends string,
> = {
  /**
   * Specifies whether the state is of type 'parallel', 'final', or standard.
   * 'Parallel' states allow simultaneous execution of sub-states, while 'final' indicates an end state.
   */
  type?: OrchestrationStateType;
  /**
   * Optional description to provide more detailed insight into the purpose or behavior of the state.
   */
  description?: string;
  /**
   * Initial state identifier for nested state configurations, required if the state type allows nesting and is not 'parallel'.
   */
  initial?: string;
  /**
   * Configuration for emitting events when entering this state.
   */
  emit?: Emit<TContext, string, zod.ZodObject<any>>;
  /**
   * List of actions configured to execute upon entering the state.
   */
  entry?: Action<TContext>[];
  /**
   * List of actions configured to execute upon exiting the state.
   */
  exit?: Action<TContext>[];
  /**
   * Configurations for transitions based on events, describing how the state machine responds to events while in this state.
   */
  on?: Transition<TContext, zod.ZodObject<any>>[];
  /**
   * Specifies the target state to transition to once all 'parallel' sub-states are completed, only applicable for 'parallel' state types.
   */
  onDone?: { target: string };
  /**
   * Allows the definition of nested states within a 'parallel' or 'final' state, supporting hierarchical state machines.
   */
  states?: Record<TState, OrchestrationStateConfigV3<TContext, string>>;
  /**
   * Defines an unconditional transition that should be triggered whenever this state is reached.
   */
  always?: Transition<TContext, zod.ZodObject<any>>;
};

/**
 * Describes a configuration for transitions that are conditional on specific guards within the state machine.
 * This type links guards with target states and associated actions, potentially including a description for clarity.
 *
 * @typeparam TContext The context type of the state machine, defining the shape of data available during state transitions.
 */
export type GuardedTransitionV3<TContext extends Record<string, any>> = {
  /**
   * The guard condition that determines if the transition should occur.
   */
  guard: Guard<TContext>;
  /**
   * The target state identifier to transition to if the guard condition is met.
   */
  target: string;
  /**
   * Optional list of actions to perform when the transition is triggered.
   */
  actions?: Action<TContext>[];
  /**
   * Optional description to provide further details about the purpose of the guarded transition.
   */
  description?: string;
};

export type BasicContext = {
  __traceId?: string;
  __machineLogs?: any[];
  __cloudevent?: CloudEvent<Record<string, any>>;
  __orchestrationTime?: {
    event_type: string;
    start: number;
    checkpoint: number;
    elapsed: number;
  }[];
  __cumulativeExecutionUnits?: {
    event_type: string;
    units: `${number}`;
  }[];
};
