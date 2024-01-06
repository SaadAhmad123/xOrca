# A Library for persistable xstate v5 actors

The `persistable-xstate-actor` library is a sophisticated and scalable tool for managing state in distributed and serverless applications. It introduces two pivotal constructs for xState actor state management: `PersistableActor` and `withPersistableActor`. These constructs are crafted to integrate flawlessly with the xstate library, offering enhanced persistence and locking capabilities to promote consistency and resilience in stateful applications and orchestrations.

Leveraging [`unified-serverless-storage`](https://www.npmjs.com/package/unified-serverless-storage?activeTab=readme) for versatile storage solutions and [`xstate (v5)`](https://stately.ai/docs/quick-start) for state management, this library stands as a cornerstone for robust stateful application development.

## Easy Installation

Install using npm:

```bash
npm install persistable-xstate-actor aws-sdk unified-serverless-storage cloudevents
```

Or via yarn:

```bash
yarn add persistable-xstate-actor aws-sdk unified-serverless-storage cloudevents
```

## Core Features

### Persistable Actor

`PersistableActor` is the cornerstone of this library, equipped to endow xstate actors with persistence and locking features.

#### Salient Features

- **Persistence**: Ensures continuity of stateful actors across various sessions or instances, a crucial aspect in serverless environments.
- **Atomic State Changes**: Implements a robust locking mechanism, safeguarding against concurrent state alterations in distributed systems.
- **Versatile Storage Options**: Compatible with diverse storage backends (like local files, S3) and locking via DynamoDB.
- **Complete Lifecycle Handling**: Manages the actor's lifecycle, encompassing initialization, state saving, and resource cleanup.

#### Typical Workflow

1. **Initialization**: Create an actor with essential parameters, including ID, storage manager, and an optional locking mode.
2. **State Recovery**: Upon initialization, the actor's state is retrieved from storage, with optional lock acquisition for safety.
3. **State Preservation**: Utilize the `save()` method to commit the actor's current state to storage.
4. **Resource Release**: Employ the `close()` method to relinquish resources and locks.

### withPersistableActor

`withPersistableActor` is a utility function designed to streamline the management of `PersistableActor`, encapsulating setup, operation, and teardown phases.

#### Key Advantages

- **Simplified Actor Lifecycle Management**: Automates the initialization and closure of `PersistableActor`, reducing complexity for developers.
- **Convenience with Callbacks**: Allows passing of a callback function to operate on the actor, enhancing ease of use.
- **Robust Error Management**: Incorporates error handling to address potential issues during the actor's operation.

#### Practical Application

Ideal for short-lived operations or tasks requiring an actor, it ensures efficient management of the actor's lifecycle, minimizing the need for repetitive code.

#### Considerations

- The state machine should not contain any asynchronous invocations.

## How to Use

### Persisting an Actor

```typescript
import { createActor } from 'xstate';
import {
  DynamoLockingManager,
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';

const actor = new PersistedActor({
  acquireLockMaxTimeout: 1000,
  locking,
  id: persistanceId,
  storageManager: new LockableStorageManager({
    storageManager: manager,
    lockingManager: lockingManager,
  }),
  actorCreator: (id, snapshot) =>
    createActor(someXStateMachine, {
      id,
      snapshot,
      input: {
        /* ..xstate context input.. */
      },
    }),
});

// Interaction with the actor
await actor.init();
// ... actor operations ...
await actor.save();
await actor.close();
```

### Simplified Actor Management with withPersistedActor

```javascript
await withPersistedActor(params, async (actor) => {
  // Operations using the actor
});
```

### CloudOrchestrationActor

This is a an extention of the xState v5 Actor class which is design to be run in a short lived cloud environment and act as a orchestration/ rules state machien executor.

#### Further Reading

For comprehensive understanding of xState, visit the [official xState documentation](https://stately.ai/docs/quick-start). For understanding of `unified-serverless-storage`, visit the [npm package page](https://www.npmjs.com/package/unified-serverless-storage?activeTab=readme).

## Contributions and Feedback

Your contributions are highly valued! We welcome enhancements in functionalities, addition of new storage backends, locking strategies, and documentation improvements.

For queries or feedback, feel free to open an issue in our [GitHub repository](https://github.com/SaadAhmad123/durable-x-state).

## License

This project is under the MIT License. For more details, refer to the [LICENSE.md](/LICENSE.md) file.
