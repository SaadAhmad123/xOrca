# `durable-x-state`: A Library for xState v5 Persistence and Locking in Severless environment

This library provides a robust and scalable system for managing state in distributed and serverless applications. It introduces two primary constructs for xState actor state management: PersistedActor and withPersistedActor. These are built to integrate seamlessly with the xstate library, offering persistence and locking capabilities to ensure consistency and resilience in stateful applications and orchestrations.

## Installation

```bash
npm install durable-x-state
```
```bash
yarn add durable-x-state
```

## Features

- **Persistent State Management**: Store and persist state objects in local files or S3.
- **Locking Mechanisms**: Ensure data integrity using DynamoDB for locking mechanisms.
- **Extensibility**: Extendable to support more storage backends and locking strategies.

## Main Components

### Storage Managers

- **StorageManagerWithLocking**: This is an abstract base class designed to provide a template for storage managers with locking capabilities. It defines a standard interface for operations like write, read, delete, and check existence of data with an added focus on lock management. Implementations of this class must provide concrete methods for these operations, ensuring that data access is managed safely, especially in environments where concurrent access to data is possible.
- **LocalFileStorageManager**: This class is a concrete implementation of StorageManagerWithLocking for local file storage, using Node.js's file system module (fs). It provides methods to write, read, delete, and check the existence of files in a specified directory on the local file system. All file paths are treated relative to a specified root directory. This class is particularly useful in environments where local storage is preferred or required.
- **S3StorageManager**: This class extends StorageManagerWithLocking and is tailored for use with Amazon S3 as the storage backend. It includes methods for interacting with S3, such as writing data to, reading data from, deleting data from, and checking the existence of data in an S3 bucket. It requires configuration details for the S3 bucket and optionally AWS access keys. If access keys are not provided, it defaults to using AWS's default credential provider chain. This class is ideal for cloud-based or distributed systems where S3 is used for data storage.

**Terraform to create the S3 bucket for `S3StorageManager`**
```hcl
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-unique-bucket-name" # Change to your unique bucket name
}

resource "aws_iam_policy" "s3_pixel_db_access" {
  name        = "${local.name_prefix}-pixeldb-access-policy"
  description = "Policy for read/write access to the pixel_db S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        Effect = "Allow",
        Resource = [
          "${aws_s3_bucket.my_bucket.arn}/*" # Granting access to all objects in the bucket
        ]
      },
      {
        Action = [
          "s3:ListBucket"
        ],
        Effect = "Allow",
        Resource = [
          aws_s3_bucket.my_bucket.arn
        ]
      }
    ]
  })
}
```

### Locking Manager

The `LockingManager` in the `durable-x-state` library plays a crucial role in managing access locks, especially important in distributed systems where concurrent access to resources can lead to conflicts or inconsistencies.

#### Overview

- **Abstract Base Class**: `LockingManager` is an abstract base class that defines the contract for locking mechanisms.
- **Purpose**: It is designed to control access locks, ensuring that only one process can modify a resource at a time.
- **Independence**: It can function independently of the storage manager, focusing solely on access control.

#### Implementation: `DynamoLockingManager`

A concrete implementation of `LockingManager` is `DynamoLockingManager`, which utilizes AWS DynamoDB for distributed locking. This implementation is specifically tailored for environments where resources are accessed and modified by multiple instances, like in serverless architectures or microservices.

##### Key Features

1. **DynamoDB Integration**: Uses AWS DynamoDB, a highly available and scalable NoSQL database service, for managing locks.
2. **Resource Path Locks**: Locks are based on resource paths, with each lock tied to a specific resource identifier.
3. **Automatic Expiry**: Implements a TTL (Time to Live) mechanism for locks, preventing stale locks from persisting indefinitely.
4. **Concurrency Control**: Ensures that only one process can access a resource at a time, preventing race conditions and data corruption.

##### Terraform Configuration

An example Terraform configuration is provided to create the required DynamoDB table. This table must have a primary key named `id` of type String. Optionally, a TTL attribute `expireAt` can be configured.

```hcl
provider "aws" {
  # Specify your AWS provider settings
  # region = "us-west-2"
  # profile = "your-profile"
}

resource "aws_dynamodb_table" "locking_table" {
  name           = "lockingTable"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"  # 'S' denotes a string type
  }

  ttl {
    attribute_name = "expireAt"
    enabled        = true
  }

  tags = {
    Name        = "LockingTable"
    Environment = "Production"
  }
}
resource "aws_iam_policy" "dynamodb_locking_policy" {
  name        = "DynamoDBLockingPolicy"
  description = "IAM policy for accessing DynamoDB Locking Table"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DescribeTable"
        ],
        Resource = aws_dynamodb_table.locking_table.arn
      }
    ]
  })
}
```

##### Constructor Parameters

- `tableName`: Name of the DynamoDB table used for locking.
- `awsAccessKey`, `awsSecretKey`, `awsRegion`: Optional AWS credentials and region settings.
- `timeToLiveDurationInSeconds`: Duration after which the lock will expire, defaulting to 900 seconds (15 minutes).

##### Methods

- `lock(path: string)`: Attempts to acquire a lock on the specified resource path. Returns a promise resolving to `true` if successful.
- `unlock(path: string)`: Releases a lock on the specified resource path. Returns a promise resolving to `true` if successful.

#### Usage Scenario

In a serverless environment or a microservices architecture, where multiple instances might attempt to read or write to a shared resource simultaneously, using `DynamoLockingManager` ensures that these operations are coordinated and safe from concurrent access issues.

This implementation is particularly useful for scenarios where robustness and reliability are critical, and it integrates seamlessly with AWS services, making it an ideal choice for applications hosted on AWS infrastructure.

### Persisted Actor

The `PersistedActor` class is a central feature in the `durable-x-state` library. It is designed to provide persistence and locking capabilities to actors, which are fundamental components in the xstate library for state management.

##### Key Characteristics

- **Persistence**: It allows stateful actors to maintain their state across sessions or instances. This is crucial in scenarios like serverless architectures where statelessness is a norm.
- **Locking Mechanism**: It integrates a locking mechanism to ensure that the actor's state changes are atomic and safe from concurrent modifications. This is particularly important in distributed systems.
- **Flexible Storage**: The class is compatible with various storage backends like local files or S3, and locking via DynamoDB.
- **Lifecycle Management**: It handles the entire lifecycle of an actor, including initialization, state persistence, and cleanup.

##### Usage Flow

1. **Initialization**: The actor is constructed with parameters including an ID, storage manager, and an optional locking mode (`write` or `read-write`).
2. **State Restoration**: During initialization (`init()`), it loads the actor's state from storage and optionally acquires a lock.
3. **State Saving**: The `save()` method is used to persist the actor's current state to the storage.
4. **Cleanup**: The `close()` method releases resources and locks, if any.

#### withPersistedActor

`withPersistedActor` is a helper function that simplifies the management of a `PersistedActor`. It is designed to streamline the process of setting up, using, and tearing down an actor.

##### Functionality

- **Easy Setup and Teardown**: It initializes and closes a `PersistedActor` instance automatically, abstracting these steps from the developer.
- **Usage Callback**: Developers can pass a callback function that receives the actor instance for executing business logic.
- **Error Handling**: It includes built-in error handling to manage exceptions that might occur during the actor's usage.

##### Practical Use

This function is particularly useful in scenarios where an actor is required for a short-lived operation or task. It ensures that all necessary steps for managing the actor's lifecycle are handled efficiently, reducing the boilerplate code required for actor management.

#### General Considerations

- **Actors in State Machines**: Actors in the context of xstate and `durable-x-state` are entities that represent a source of behavior and state. They are often used to encapsulate logic and state in state machines.
- **Serverless Environments**: Both `PersistedActor` and `withPersistedActor` are ideal for serverless environments where maintaining state across function invocations is challenging due to the stateless nature of such architectures.
- **Scalability and Reliability**: The integration of locking mechanisms and flexible storage options makes these tools highly scalable and reliable for managing state in distributed systems.

In summary, `PersistedActor` and `withPersistedActor` bring robust state management capabilities to the xstate library, making them invaluable for applications that require persistent and consistent state management in distributed or serverless environments.

## Usage

### Persisting an Actor

```javascript
// Initialize a persisted actor with a specific storage manager and locking strategy
const actor = new PersistedActor({
  id: "unique-actor-id",
  storageManager: new LocalFileStorageManager(...params), // or S3StorageManager
  actorCreator: createActor, // Your function to create an xstate actor
  locking: "read-write" // or "write"
});

// Use the actor in your application
await actor.init();
// ... interact with the actor ...
await actor.save();
await actor.close();
```

### Using withPersistedActor

```javascript
await withPersistedActor(params, async (actor) => {
  // Your code to interact with the actor
});
```

#### Additional Resources

For more information on xState, see the documentation [here](https://stately.ai/docs/quick-start)


## Contributing and feedback

Contributions are welcome to extend the library's functionalities, add more storage backends, locking strategies, or improve documentation.

For any questions or feedback, please open an issue in the GitHub repository.

## License

This project is licensed under the MIT License - see the [LICENSE.md](/LICENSE.md) file for details.