import { CloudEvent } from 'cloudevents';
import { OrchestrationStateType } from '../types';
import Action from './Action';
import Emit from './Emit';
import Guard from './Guard';
import Transition from './Transition';
import * as zod from 'zod';
import { EventObject, MachineContext } from 'xstate';

/**
 * Represents the configuration schema for an orchestration state machine, encompassing states, transitions,
 * actions, and the context within which these states operate.
 *
 * Attributes:
 * - `id`: A unique identifier for the orchestration machine, crucial for distinguishing between different machines.
 * - `description`: An optional detailed description of the orchestration machine's purpose and its functional scope.
 * - `context`: A function or static object that defines the initial state context, either generated statically or dynamically based on input data.
 * - `initial`: The initial state identifier the machine will enter upon instantiation, required unless the type is 'parallel'.
 * - `type`: The type of state machine, such as 'parallel', affecting how states are managed and executed.
 * - `states`: A mapping of state identifiers to their configurations, detailing behavior and structural relationships.
 *
 * @typeparam TContext Describes the type of the state context, encapsulating the structure and data within each state.
 * @typeparam TInput Defines the type of input data that influences or initializes the state context.
 */
export type OrchestrationMachineConfigV3<
  TContext extends Record<string, any>,
  TInput extends Record<string, any> = Record<string, any>,
> = {
  id: string;
  description?: string;
  context?: (params: { input: TInput }) => TContext;
  initial?: string;
  type?: Exclude<OrchestrationStateType, 'final'>;
  states: Record<string, OrchestrationStateConfigV3<TContext>>;
};

/**
 * Configures individual states within an orchestration machine, including details on state types, transitions,
 * actions, and nested states.
 *
 * Attributes:
 * - `type`: Specifies the state's operational mode—'parallel', 'final', or standard. Defines whether the state can run concurrently with others or is an endpoint.
 * - `description`: An optional detailed explanation of the state's purpose or behavior.
 * - `initial`: Identifier for the initial state within nested configurations, required for non-parallel types.
 * - `emit`: Configurations for emitting events upon state entry, facilitating reactive programming.
 * - `entry`: Actions to execute upon entering the state, which can modify the context or trigger side effects.
 * - `exit`: Actions to execute upon exiting the state, important for cleanup or final state adjustments.
 * - `on`: Event-driven transitions detailing responses to events within this state.
 * - `onDone`: Target state after completing all sub-states in a 'parallel' configuration.
 * - `states`: Definitions of nested states, supporting hierarchical state structures.
 * - `always`: An unconditional transition that triggers when the state is reached, ensuring smooth progressions.
 *
 * @typeparam TContext The context type of the state machine, defining the shape of data available during state transitions.
 */
export type OrchestrationStateConfigV3<TContext extends Record<string, any>> = {
  type?: OrchestrationStateType;
  description?: string;
  initial?: string;
  emit?: Emit<TContext, string, zod.ZodObject<any>>;
  entry?: Action<TContext>[];
  exit?: Action<TContext>[];
  on?: Transition<TContext>[];
  onDone?: { target: string };
  states?: Record<string, OrchestrationStateConfigV3<TContext>>;
  always?: Transition<TContext>;
};

/**
 * Describes configurations for state transitions within the state machine that are contingent on specific conditions
 * or guards. This type links guard conditions with transitions, actions, and optionally, descriptions for enhanced clarity.
 *
 * Attributes:
 * - `guard`: The condition under which the transition should occur, critical for controlling state flow based on dynamic context or events.
 * - `target`: The identifier of the state to transition to if the guard condition is met, defining the path of the state machine.
 * - `actions`: An optional list of actions to execute when the transition is triggered, enabling dynamic responses. Default is: withBasicActions()
 * - `description`: An optional detailed description of the transition's purpose, aiding in understanding and documentation.
 *
 * @typeparam TContext The context type of the state machine, defining the data available during transitions.
 * @typeparam TEventData Specifies the type of event data that triggers the guarded transition, providing context and conditions for the transition.
 */
export type GuardedTransitionV3<
  TContext extends Record<string, any>,
  TEventData extends Record<string, any>,
> = {
  guard: Guard<TContext, TEventData>;
  target: string;
  actions?: Action<TContext, TEventData>[];
  description?: string;
};

/**
 * Represents the standard context for a state machine, incorporating critical metadata that enhances
 * monitoring and analysis of the state machine's operation. This context is designed to be extended with
 * specific state data for a customized state machine context.
 *
 * @typeparam TData The type of additional data fields that can be added to the basic context structure.
 *
 * Attributes:
 * - `__traceId`: An optional OpenTelemetry trace ID that uniquely identifies the workflow's execution trace,
 *                facilitating the tracing of transactions and operations across distributed systems.
 * - `__machineLogs`: An array of logs capturing a chronological record of all significant state updates and
 *                    actions taken by the state machine. Primarily used for debugging and audit purposes.
 * - `__cloudevent`: An optional field storing the most recently received CloudEvent, which standardizes event
 *                   data across services, platforms, and systems, promoting interoperability.
 * - `__orchestrationTime`: Records timing details of significant events within the state machine's operation,
 *                          tracking the start times and durations, useful for performance analysis and optimization.
 * - `__cumulativeExecutionUnits`: Tracks the computational effort expended by the state machine, recording the
 *                                 type of event and the computation units consumed, aiding in resource management
 *                                 and operational analysis.
 */
export type BasicContext<TData extends Record<string, any>> = {
  __traceId?: string;
  __machineLogs?: {
    cloudeventId: string;
    cloudevent: CloudEvent<any>;
    context: Record<string, any>;
    timestamp: number;
    isoTime: string;
  }[];
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
} & TData;

/**
 * Defines a basic event object structure for a state machine, integrating custom data with standard
 * event properties from the xState library and a CloudEvent for standard event formatting across systems.
 *
 * @typeparam TData The type of data that the event carries, extending the basic event structure with
 *                  specific data fields relevant to the state machine's operation.
 *
 * Attributes:
 * - `__data`: Custom data specific to the event, enhancing the event with additional context or metadata
 *             necessary for the state transitions or actions.
 * - `__cloudevent`: A CloudEvent that encapsulates the event data in a standardized format, ensuring consistency
 *                   and interoperability of event data across different systems and services.
 */
export type BasicEventObject<TData extends Record<string, any>> =
  EventObject & {
    __data: TData;
    __cloudevent: CloudEvent<TData>;
  } & TData;
