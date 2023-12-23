import * as fs from 'fs';
import * as path from 'path';
import { LocalFileStorageManager, withPersistedActor } from '.';
import trafficStateMachine from './index.spec.data';
import { WithPersistanceInput } from './types';
import { createActor } from 'xstate';

describe('Testing with persistance', () => {
  let rootDir: string;
  let manager: LocalFileStorageManager;
  const persistanceId: string = 'saad';

  const getPersistedActorParams = (locking?: "write" | "read-write") => ({
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
  } as WithPersistanceInput<typeof trafficStateMachine>)

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

  it('[No Locking] It should load no snapshot when no state available and then persist the state after an update', async () => {
    await withPersistedActor(
      getPersistedActorParams(), 
      async (actor) => {
        actor.start();
        expect(actor.getSnapshot().value).toBe('Green');
        expect(actor.getSnapshot().context.count).toBe(0);
        actor.send({ type: 'HALT' });
        expect(actor.getSnapshot().value).toBe('Yellow');
        expect(actor.getSnapshot().context.count).toBe(0.25);
        actor.stop();
      }
    )
  });

  it('[No Locking] It should load from the old persisted state and then act on it', async () => {
    await withPersistedActor(
      getPersistedActorParams(),
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
      }
    )
  });
});
