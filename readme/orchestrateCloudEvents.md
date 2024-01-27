# Function `orchestrateCloudEvents`

```typescript
/**
 * Orchestrates cloud events, providing a streamlined solution for complex workflows.
 *
 * @template TLogic - Generic type representing the logic associated with orchestration.
 * @param param - Configuration for the state machine and storage.
 * @param events - Cloud events from ongoing orchestration processes (identified by process ID in the CloudEvent subject).
 * @param inits - Initialization objects for orchestrating new processes.
 * @returns A promise resolving to an object containing orchestration results.
 * @property errors - Array of errors encountered during orchestration, including associated events and initialization events.
 * @property eventsToEmit - Cloud events to be emitted as part of orchestration.
 * @property processContext - Context information derived from the orchestration process IDs.
 */
async function orchestrateCloudEvents<TLogic>(
  param: OrchestrationConfig,
  events: CloudEvent<Record<string, any>>[],
  inits?: InitialOrchestrationEvent<TLogic>[],
): Promise<{
  errors: {
    error: string;
    events?: CloudEvent<Record<string, any>>[];
    initEvents?: InitialOrchestrationEvent<TLogic>[];
  }[];
  eventsToEmit: CloudEvent<Record<string, any>>[];
  processContext: Record<string, ContextFrom<TLogic>>;
}>;
```

For detailed information, refer to the [Typedocs](https://saadahmad123.github.io/xOrca/functions/orchestrateCloudEvents.html).

This function serves as a pivotal component, seamlessly integrating orchestration into your codebase. By effectively managing state creation, persistence, and rules engine execution, it provides a user-friendly solution for orchestrating intricate workflows.

The function takes the configuration for the state machine and storage, along with `events` representing cloud events from active orchestration processes (identified by the process ID in the CloudEvent subject). Additionally, it accepts `inits`—a list of objects used to initialize new orchestration processes. The returned promise resolves to an object containing orchestration results, including encountered errors, events to be emitted, and contextual information derived from orchestration process IDs.

## Example

```typescript
import {
  DynamoLockingManager,
  LockableStorageManager,
  S3StorageManager,
} from 'unified-serverless-storage';
import { createOrchestrationMachine, orchestrateCloudEvents } from 'xorca';

const config = {}; // The config with the env variables

const storageManager = new S3StorageManager(
  config.ORCH_BACKEND_S3_STORAGE,
  config.ORCH_BACKEND_S3_STORAGE_FOLDER,
  config.AWS_ACCESS_KEY_ID,
  config.AWS_SECRET_ACCESS_KEY,
  config.AWS_REGION,
);

const lockingManager = new DynamoLockingManager(
  config.ORCH_BACKEND_LOCKING_TABLE,
  config.AWS_ACCESS_KEY_ID,
  config.AWS_SECRET_ACCESS_KEY,
  config.AWS_REGION,
);

/**
 * Define the storage backend
 */
const store = new LockableStorageManager({
  storageManager,
  lockingManager,
});

// Example orchestration machine creation
// For sample
const machine =
  createOrchestrationMachine(/* See the [docs here](/readme/createOrchestrationMachine.md) */);
async function main() {
  const events: Array<CloudEvent<Record<string, any>>> = []; // List already running orchestration event
  const inits: Array<InitialOrchestrationEvent<any>> = []; // List of initialisations

  const { eventsToEmit, processContext, errors } =
    await orchestrateCloudEvents(
      {
        name: stateMachineName,
        statemachine: [
          {
            version: '0.0.1',
            orchestrationMachine: machine,
          },
        ],
        storageManager: store,
        // Optional
        locking: 'write',
        // Optional
        onSnapshot: (...args) => {
          console.log({ ...args });
        },
      },
      events,
      inits,
    );

  return { eventsToEmit };
}

main();
```
