import * as fs from 'fs';
import * as path from 'path';
import { withPersistableActor, PersistableActor } from '.';
import trafficStateMachine from './index.spec.data';
import { PersistableActorInput } from './types';
import { Actor, createActor } from 'xstate';
import { config } from 'dotenv';
import {
  DynamoLockingManager,
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import { DynamoDbManager } from './index.spec.lib';
config();

const { AWS_ACCESS_KEY, AWS_SECRET_KEY, TEST_DYNAMO_DB_NAME, AWS_REGION } =
  process.env;

const tableName = `${TEST_DYNAMO_DB_NAME}-wp`;

const dynamoManager = new DynamoDbManager(
  tableName,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_REGION,
);

describe('Testing with persistance', () => {
  let rootDir: string;
  let manager: LocalFileStorageManager;
  let lockingManager: DynamoLockingManager;
  const persistanceId: string = 'saad';

  const getPersistedActorParams = (
    persistanceId: string,
    locking?: 'write' | 'read-write',
  ) =>
    ({
      acquireLockMaxTimeout: 1000,
      locking,
      id: persistanceId,
      storageManager: new LockableStorageManager({
        storageManager: manager,
        lockingManager: lockingManager,
      }),
      actorCreator: (id, snapshot) =>
        createActor(trafficStateMachine, {
          id,
          snapshot,
          input: {
            count: -1 / 4,
          },
        }),
    }) as PersistableActorInput<
      typeof trafficStateMachine,
      Actor<typeof trafficStateMachine>
    >;

  beforeAll(async () => {
    // Create a temporary directory for testing
    rootDir = path.join(__dirname, '.statemachine');
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir);
    }
    manager = new LocalFileStorageManager(rootDir);
  });

  afterAll(() => {
    fs.rmdirSync(rootDir, { recursive: true });
  });

  beforeAll(async () => {
    if (await dynamoManager.doesTableExist()) return;
    await dynamoManager.createTable();
    if (!(await dynamoManager.waitForReady(20000))) {
      throw new Error(
        `DynamoDB table=${TEST_DYNAMO_DB_NAME} not ready to be used`,
      );
    }
    lockingManager = new DynamoLockingManager(
      tableName,
      AWS_ACCESS_KEY,
      AWS_SECRET_KEY,
      AWS_REGION,
    );
  }, 40000);

  afterAll(async () => {
    if (!(await dynamoManager.doesTableExist())) return;
    await dynamoManager.deleteTable();
  }, 10000);

  it('[No Locking] It should load no snapshot when no state available and then persist the state after an update', async () => {
    await withPersistableActor(
      getPersistedActorParams(persistanceId),
      async (actor) => {
        actor.start();
        expect(actor.getSnapshot().value).toBe('Green');
        expect(actor.getSnapshot().context.count).toBe(0);
        actor.send({ type: 'HALT' });
        expect(actor.getSnapshot().value).toBe('Yellow');
        expect(actor.getSnapshot().context.count).toBe(0.25);
        actor.stop();
      },
    );
  });

  it('[No Locking] It should load from the old persisted state and then act on it', async () => {
    await withPersistableActor(
      getPersistedActorParams(persistanceId),
      async (actor) => {
        actor.start();
        expect(actor.getSnapshot().value).toBe('Yellow');
        expect(actor.getSnapshot().context.count).toBe(0.25);
        actor.send({ type: 'HALT' });
        expect(actor.getSnapshot().value).toBe('Red');
        expect(actor.getSnapshot().context.count).toBe(0.5);
        actor.send({ type: 'HALT' });
        expect(actor.getSnapshot().value).toBe('Red');
        expect(actor.getSnapshot().context.count).toBe(0.5);
        actor.send({ type: 'MOVE' });
        expect(actor.getSnapshot().value).toBe('Yellow');
        expect(actor.getSnapshot().context.count).toBe(0.75);
        actor.stop();
      },
    );
  });

  it('[With Locking] It should load no snapshot when no state available and then persist the state after an update', async () => {
    const pid = `wp-${persistanceId}`;
    const persistedActor = new PersistableActor(
      getPersistedActorParams(pid, 'read-write'),
    );

    await persistedActor.init();
    await expect(persistedActor.init()).rejects.toThrow(
      `Actor already initiated, close it to re-initiate`,
    );
    await expect(persistedActor.init(false)).rejects.toThrow(
      `Could not acquire lock on path ${pid}.json.`,
    );
    await persistedActor.close();

    await withPersistableActor(
      getPersistedActorParams(`wp-${persistanceId}`, 'read-write'),
      async (actor) => {
        actor.start();
        expect(actor.getSnapshot().value).toBe('Green');
        expect(actor.getSnapshot().context.count).toBe(0);
        actor.send({ type: 'HALT' });
        expect(actor.getSnapshot().value).toBe('Yellow');
        expect(actor.getSnapshot().context.count).toBe(0.25);
        actor.stop();
      },
    );
  }, 10000);
});
