import * as fs from 'fs';
import * as path from 'path';
import { LocalFileStorageManager, PersistanceLockError, PersistedActor, withPersistedActor } from '.';
import trafficStateMachine from './index.spec.data';
import { WithPersistanceInput } from './types';
import { createActor } from 'xstate';
import { config } from 'dotenv';
import DynamoLockingManager from './storage_manager/dynamo_locking_manager';
import { DynamoDbManager } from './storage_manager/dyanmo_locking_manager.spec.lib';
config();

const { AWS_ACCESS_KEY, AWS_SECRET_KEY, TEST_DYNAMO_DB_NAME, AWS_REGION } =
  process.env;


const tableName = `${TEST_DYNAMO_DB_NAME}-wp`
const lockingManager = new DynamoLockingManager(
  tableName,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_REGION,
);

const dynamoManager = new DynamoDbManager(
  tableName,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_REGION,
);


describe('Testing with persistance', () => {
  let rootDir: string;
  let manager: LocalFileStorageManager;
  const persistanceId: string = 'saad';

  const getPersistedActorParams = (
    persistanceId: string,
    locking?: 'write' | 'read-write',
  ) =>
    ({
      acquireLockMaxTimeout: 1000,
      locking,
      id: persistanceId,
      storageManager: manager,
      actorCreator: (id, snapshot) =>
        createActor(trafficStateMachine, {
          id,
          snapshot,
          input: {
            count: -1 / 4,
          },
        }),
    }) as WithPersistanceInput<typeof trafficStateMachine>;

  beforeAll(async () => {
    // Create a temporary directory for testing
    rootDir = path.join(__dirname, '.statemachine');
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir);
    }
    manager = new LocalFileStorageManager(rootDir, lockingManager);
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
  }, 40000);

  afterAll(async () => {
    if (!(await dynamoManager.doesTableExist())) return;
    await dynamoManager.deleteTable();
  }, 10000);

  it('[No Locking] It should load no snapshot when no state available and then persist the state after an update', async () => {
    await withPersistedActor(getPersistedActorParams(persistanceId), async (actor) => {
      actor.start();
      expect(actor.getSnapshot().value).toBe('Green');
      expect(actor.getSnapshot().context.count).toBe(0);
      actor.send({ type: 'HALT' });
      expect(actor.getSnapshot().value).toBe('Yellow');
      expect(actor.getSnapshot().context.count).toBe(0.25);
      actor.stop();
    });
  });

  it('[No Locking] It should load from the old persisted state and then act on it', async () => {
    await withPersistedActor(getPersistedActorParams(persistanceId), async (actor) => {
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
    });
  });

  it('[With Locking] It should load no snapshot when no state available and then persist the state after an update', async () => {

    const pid = `wp-${persistanceId}`
    const persistedActor = new PersistedActor(
      getPersistedActorParams(
        pid, 
        "read-write"
      )
    )

    await persistedActor.init()
    await expect(persistedActor.init()).rejects.toThrow(`Actor already initiated, close it to re-initiate`)
    await expect(persistedActor.init(false)).rejects.toThrow(`Could not acquire lock on path ${pid}.json.`)
    await persistedActor.close()

    await withPersistedActor(getPersistedActorParams(
      `wp-${persistanceId}`, 
      "read-write"
    ), async (actor) => {
      actor.start();
      expect(actor.getSnapshot().value).toBe('Green');
      expect(actor.getSnapshot().context.count).toBe(0);
      actor.send({ type: 'HALT' });
      expect(actor.getSnapshot().value).toBe('Yellow');
      expect(actor.getSnapshot().context.count).toBe(0.25);
      actor.stop();
    });
  }, 10000);

});
