import { Logger } from 'xorca-cloudevent-router';
import { AnyActorLogic, SnapshotFrom } from 'xstate';
import * as zod from 'zod';
import { CloudEvent } from 'cloudevents';
import { ILockableStorageManager } from 'unified-serverless-storage';
import { Version } from '../cloud_orchestration_actor/types';
import { OrchestrationMachine } from '../create_orchestration_machine/types';

/**
 * Defines a version-specific orchestration state machine configuration.
 * This includes the version of the state machine and its associated logic.
 *
 * @template TLogic - Specifies the logic type that governs the state machine's behavior.
 */
export type VersionedOrchestrationMachine<TLogic extends AnyActorLogic> = {
  /**
   * Specifies the version of the state machine logic, adhering to semantic versioning.
   * @example '1.0.0' - Example version format.
   */
  version: Version;

  /**
   * Represents the logic of the orchestration state machine for the given version.
   * This machine should be instantiated using `createOrchestrationMachineV2`.
   */
  orchestrationMachine: OrchestrationMachine<TLogic>;
};

/**
 * Describes a basic orchestration router interface, including the unique orchestrator name,
 * the state machine logic, storage management, and optional snapshot handling.
 *
 * @template TLogic - Defines the logic type that controls the orchestration's behavior.
 */
export interface IBasicOrchestrationRouter<TLogic extends AnyActorLogic> {
  /**
   * Unique name for the orchestrator, used in constructing event handler topics.
   */
  name: string;

  /**
   * A list of state machine logics with their corresponding versions, dictating the orchestration's behavior.
   */
  statemachine: VersionedOrchestrationMachine<TLogic>[];

  /**
   * Manages state persistence of the orchestration, ensuring concurrent access control.
   * It must adhere to the `ILockableStorageManager` interface from `unified-serverless-storage`.
   */
  storageManager: ILockableStorageManager;

  /**
   * Dictates the locking strategy for storage operations to manage concurrent access.
   * - "write": Only write operations acquire locks.
   * - "read-write": Both read and write operations acquire locks.
   */
  locking?: 'write' | 'read-write';

  /**
   * Optional function to handle snapshots, providing insights into the orchestration's state at specific points.
   * @param processId - Identifies the orchestration process.
   * @param snapshot - Captures the current state of the orchestration.
   */
  onSnapshot?: (processId: string, snapshot: SnapshotFrom<TLogic>) => void;
}

/**
 * Extends the basic orchestration router interface with additional configuration options,
 * including a description, logging capabilities, initial context schema validation, and
 * optional routing metadata enhancement.
 *
 * @template TLogic - Specifies the logic type governing the orchestration's behavior.
 */
export interface IOrchestrationRouter<TLogic extends AnyActorLogic>
  extends IBasicOrchestrationRouter<TLogic> {
  /**
   * Optional descriptive text about the orchestration router.
   */
  description?: string;

  /**
   * Optional logger function for accessing router logs, facilitating debugging and monitoring.
   */
  logger?: Logger;

  /**
   * Schema for validating the initial context data, utilizing Zod for schema definition.
   */
  initialContextZodSchema: zod.ZodObject<any>;

  /**
   * Controls the inclusion of `to` and `redirectto` fields in output CloudEvents.
   * - `true`: Enables routing metadata, allowing dynamic event targeting.
   * - `false` (default): Disables routing metadata, with `to` and `redirectto` fields nullified.
   * Use sparingly, as orchestrators typically target services dynamically without preset destinations.
   */
  enableRoutingMetaData?: boolean;
  
  /**
   * An optional configuration object for the router that specifies which error events should be triggered under certain conditions. 
   * This allows for fine-grained control over error handling, enabling applications to respond to specific error scenarios more effectively.
   */
  raiseError?: {
    /**
     * Determines whether an error should be raised when there is a mismatch between the orchestrator name specified in an event and the expected orchestrator name.
     * 
     * When set to `true`, an error event is triggered if the name of the orchestrator that constructed the subject of the event does not match the orchestrator name that the router was expecting. This can be useful for detecting and responding to configuration errors or unauthorized attempts to trigger events.
     * 
     * Setting this flag to `false` disables the error check, which might be suitable in environments where the orchestrator name is dynamic or verification is handled elsewhere.
     */
    onInvalidOrchestratorName: boolean;
  }

}

/**
 * Defines the structure of responses from the orchestration router, including event details,
 * operation success status, and error information if applicable.
 */
export type OrchestrationRouterResponse = {
  /**
   * The original event
   */
  event: CloudEvent<Record<string, any>>;
  /**
   * Flag informing on successful execution
   */
  success: boolean;
  /**
   * Error message text
   */
  errorMessage?: string;
  /**
   * Error stack text
   */
  errorStack?: string;
  /**
   * Error type text
   */
  errorType?: string;
  /**
   * The event to emit after processing
   */
  eventToEmit?: CloudEvent<Record<string, any>>;
};
