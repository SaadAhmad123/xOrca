import { config } from 'dotenv';
import DynamoLockingManager from './dynamo_locking_manager';
import { DynamoDbManager } from './dyanmo_locking_manager.spec.lib';
config();

const { AWS_ACCESS_KEY, AWS_SECRET_KEY, TEST_DYNAMO_DB_NAME, AWS_REGION } =
  process.env;

const lockingManager = new DynamoLockingManager(
  TEST_DYNAMO_DB_NAME || '',
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_REGION,
);

const dynamoManager = new DynamoDbManager(
  TEST_DYNAMO_DB_NAME || '',
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_REGION,
);

describe('DynamoLockingManager', () => {
  const pathToLock = 'some-resource.xml';

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

  it('Acquire lock and then check if it is locked', async () => {
    let locked = await lockingManager.lock(pathToLock);
    expect(locked).toBe(true);
    locked = await lockingManager.lock(pathToLock);
    expect(locked).toBe(false);
  });

  it('Unlock the acquired lock', async () => {
    let unlocked = await lockingManager.unlock(pathToLock);
    expect(unlocked).toBe(true);
    unlocked = await lockingManager.unlock(pathToLock);
    expect(unlocked).toBe(false);
    let locked = await lockingManager.lock(pathToLock);
    expect(locked).toBe(true);
    locked = await lockingManager.lock(pathToLock);
    expect(locked).toBe(false);
  });
});
