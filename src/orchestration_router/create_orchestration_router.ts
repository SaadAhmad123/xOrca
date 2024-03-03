import { AnyActorLogic } from 'xstate';
import { IOrchestrationRouter } from './types';
import OrchectrationRouter from '.';
import { createOrchestrationInitHandler } from './init_handler';
import { createOrchestrationHandler } from './orchestration_handler';
import { createOrchestrationSystemErrorHandler } from './orchestration_system_error_handler';

/**
 * Creates and configures an instance of an orchestration router. This router is responsible for
 * managing the initialization, handling, and error management of orchestrations within the xOrca system.
 * The router uses the specified parameters to set up the necessary handlers for orchestration processes,
 * including initialization, orchestration logic handling, and error handling.
 *
 * @template TLogic - A type parameter that extends `AnyActorLogic`, representing the logic
 * type that governs the behavior of the state machine within the orchestration router.
 * 
 * @param params - Configuration parameters shaping the behavior and capabilities of the orchestration router.
 * - `name`: Uniquely identifies the router within the system. Ensure uniqueness to prevent conflicts.
 * - `description`: Optional. Describes the router's purpose or behavior for better understandability.
 * - `locking`: Optional. Defines the concurrency control strategy for storage operations. Choose between 'write' (for write operations only) or 'read-write' (for both).
 * - `onSnapshot`: Optional. Callback for when a state snapshot is taken, useful for state monitoring or logging.
 * - `storageManager`: Manages state persistence, adhering to the `ILockableStorageManager` interface for concurrency control.
 * - `enableRoutingMetaData`: Optional. Enables dynamic event targeting by including routing metadata in CloudEvents. Use judiciously as it might not be suitable for all orchestrations.
 * - `initialContextZodSchema`: Validates the initial context data against a Zod schema to ensure correct orchestration initialization.
 * - `logger`: Optional. Facilitates logging for router activities, aiding in debugging and monitoring.
 * 
 * @returns {OrchestratorRouter<TLogic>} - An instance of `OrchestratorRouter` configured with the specified parameters.
 *                                         This router manages the lifecycle and processing of orchestrations in the system.
 * 
 * -------------
 * # Explanation
 * In the router setup, various cloud events are defined to handle different stages of the 
 * orchestration process, including initialization, command and notification emission, and error handling. 
 * Each event type has a specific purpose, indicating the state of the orchestration process or signaling errors. 
 * Understanding these events, when and why they are raised, and the source of errors can help users 
 * effectively manage and debug their orchestration workflows. Below, each event type is described in detail:
 * 
 * ### Initialization Event [Input]
 * 
 * - **Event Type**: `type=xorca.${params.name}.start`
 * - **Purpose**: This event triggers the start of a new orchestration process. It is the entry point for any orchestration, signaling the system to initiate the defined workflow.
 * - **When and Why It Is Raised**: Received or expected to be received when there's a need to start a new orchestration process, based on user actions, scheduled tasks, or as a result of another orchestration process.
 * 
 * ### Orchestration Event [Input]
 * 
 * - **Event Type**: `type=evt.*`
 * - **Purpose**: This event triggers the next state of the orchestration.
 * - **When and Why It Is Raised**: Received or expected to be received during the orchestration process
 * 
 * ### Command and Notification Events [Output]
 * 
 * - **Event Types**: `type=cmd.*` and `type=notif.*`
 * - **Purpose**: These events are emitted during the orchestration process for executing commands (`cmd.*`) or sending notifications (`notif.*`). They are defined by the orchestration logic to dictate subsequent actions or inform stakeholders of the process status.
 * - **When and Why It Is Raised**: Raised during the orchestration process when the state machine logic determines that a specific action needs to be taken (command) or when an update needs to be communicated (notification).
 * - **Error Source**: These events themselves are not sources of errors but are part of the orchestration's normal workflow.
 * 
 * ### Initialization Error Event [Output]
 * 
 * - **Event Type**: `type=xorca.${params.name}.start.error`
 * - **Purpose**: Indicates an error encountered during the initialization of a new orchestration process.
 * - **When and Why It Is Raised**: Raised if there's an error in the orchestration logic or in loading the initial state from the backend during the start of a new process.
 * - **Error Source**: Errors in the orchestration machine logic or issues with state loading from the backend.
 * 
 * ### System Initialization Error Event [Output]
 * 
 * - **Event Type**: `type=sys.xorca.${params.name}.start.error`
 * - **Purpose**: Signals an error raised before the orchestration machine begins processing the event, typically due to schema validation failures.
 * - **When and Why It Is Raised**: Raised when the incoming event's `data` field does not match the expected schema (`params.initialContextZodSchema`), indicating a mismatch between the provided data and the expected initial context format.
 * - **Error Source**: Schema mismatch errors or other pre-processing errors before the orchestration logic takes over.
 * 
 * ### Orchestration Error Event [Output]
 * 
 * - **Event Type**: `type=xorca.orchestrator.${params.name}.error`
 * - **Purpose**: Indicates an error encountered during the orchestration process after it has started.
 * - **When and Why It Is Raised**: Raised when there's an error within the orchestration logic or issues in state loading from the backend while the process is underway.
 * - **Error Source**: Errors arising from the orchestration machine logic or backend state loading during the orchestration process.
 * 
 * ### System Orchestration Error Event [Output]
 * 
 * - **Event Type**: `type=sys.orchestrator.${params.name}.error`
 * - **Purpose**: Signals a system-level error occurring during the orchestration process, similar to the system initialization error but occurring after the process has started.
 * - **When and Why It Is Raised**: Raised due to errors before the orchestration logic can proceed with processing the event, often related to schema validation issues similar to the system initialization error event.
 * - **Error Source**: Pre-processing errors during the orchestration process, typically related to data schema mismatches or other validation issues.
 * 
 * ### Orchestration Initialisation:
See the following mermaid md diagram
```mermaid
sequenceDiagram
participant Process as Orchestration Event Receive
participant SysError as System level Pre-processing validations
participant OrchError as Orchestration verification
participant CmdNotif as  Orchestration State handling
participant Machine as Orchestration Machine
Process->>SysError: Cloudevent (type=xorca.${params.name}.start)
SysError->>OrchError: Cloudevent (type=xorca.${params.name}.start) validate againt `params.initialContextZodSchema`
OrchError->>CmdNotif: Cloudevent `subject` is created and passed to create a the state
CmdNotif->>Machine: Orchestration state passed to rehydrate the machine
OrchError->>Machine: Cloudevent `data` to hydrate the initial context of the machine
Note over Process, Machine: Cloudevent handling
Machine->>OrchError: New `data` and `type` for the next event if available.
Machine->>CmdNotif: New orchestration state to update
alt Successful response
OrchError->>Process: Next cloudevent (type=cmd.* or notif.*) with data. Also updated the state successfully
else State update or loading error
CmdNotif->>Process: Emit type=xorca.${params.name}.start.error
else Machine processing error
Machine->>Process: Emit type=xorca.${params.name}.start.error
else Input/ output event validation error
OrchError->>Process: Emit type=xorca.${params.name}.start.error
else System Level Pre-Processing Error
SysError->>Process: Emit type=sys.xorca.${params.name}.start.error
end
```
 *
 * ### Orchestration Processing:
See the following mermaid md diagram
```mermaid
sequenceDiagram
participant Process as Orchestration Event Receive
participant SysError as System level Pre-processing validations
participant OrchError as Orchestration verification
participant CmdNotif as  Orchestration State handling
participant Machine as Orchestration Machine
Process->>SysError: Cloudevent (type=evt.*)
SysError->>OrchError: Cloudevent (type=evt.*)
OrchError->>CmdNotif: Cloudevent `subject` passed to fetch the state
CmdNotif->>Machine: Orchestration state passed to rehydrate the machine
OrchError->>Machine: Cloudevent `data` and `type` fields passed
Note over Process, Machine: Cloudevent handling
Machine->>OrchError: New `data` and `type` for the next event if available.
Machine->>CmdNotif: New orchestration state to update
alt Successful response
OrchError->>Process: Next cloudevent (type=cmd.* or notif.*) with data. Also updated the state successfully
else State update or loading error
CmdNotif->>Process: Emit type=xorca.orchestrator.${params.name}.error
else Machine processing error
Machine->>Process: Emit type=xorca.orchestrator.${params.name}.error
else Input/ output event validation error
OrchError->>Process: Emit type=xorca.orchestrator.${params.name}.error
else System Level Pre-Processing Error
SysError->>Process: Emit type=sys.xorca.orchestrator.${params.name}.error
end
```
 */
export function createOrchestrationRouter<TLogic extends AnyActorLogic>(
  params: IOrchestrationRouter<TLogic>,
) {
  return new OrchectrationRouter({
    name: params.name,
    description: params.description,
    handlers: [
      createOrchestrationInitHandler(params),
      createOrchestrationHandler(params),
      createOrchestrationSystemErrorHandler(params),
    ],
  });
}
