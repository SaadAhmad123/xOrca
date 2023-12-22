import * as fs from 'fs';
import * as path from 'path';
import { LocalFileStorageManager, withPersistance } from '.';
import { createActor } from 'xstate';
import trafficStateMachine from './index.spec.data';
import { assert } from 'console';

describe('Testing with persistance', () => {
  let rootDir: string;
  let manager: LocalFileStorageManager;
  const persistanceId: string = 'saad';

  const getPersistedActor = async () =>
    await withPersistance({
      id: persistanceId,
      persistanceLayer: manager,
      actorCreator: (id, snapshot) =>
        createActor(trafficStateMachine, {
          id,
          snapshot,
          input: {
            count: -1 / 4,
          },
        }),
    });

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

  it('It should load no snapshot when no state available and then persist the state after an update', async () => {
    const persistedActor = await getPersistedActor();
    persistedActor.actor.start();
    expect(persistedActor.actor.getSnapshot().value).toBe('Green');
    expect(persistedActor.actor.getSnapshot().context.count).toBe(0);
    persistedActor.actor.send({ type: 'HALT' });
    expect(persistedActor.actor.getSnapshot().value).toBe('Yellow');
    expect(persistedActor.actor.getSnapshot().context.count).toBe(0.25);
    persistedActor.actor.stop();
    await persistedActor.persist();
  });

  it('It should load from the old persisted state and then act on it', async () => {
    const persistedActor = await getPersistedActor();
    persistedActor.actor.start();
    expect(persistedActor.actor.getSnapshot().value).toBe('Yellow');
    expect(persistedActor.actor.getSnapshot().context.count).toBe(0.25);
    persistedActor.actor.send({ type: 'HALT' });
    expect(persistedActor.actor.getSnapshot().value).toBe('Red');
    expect(persistedActor.actor.getSnapshot().context.count).toBe(0.5);
    persistedActor.actor.send({ type: 'HALT' });
    expect(persistedActor.actor.getSnapshot().value).toBe('Red');
    expect(persistedActor.actor.getSnapshot().context.count).toBe(0.5);
    persistedActor.actor.send({ type: 'MOVE' });
    expect(persistedActor.actor.getSnapshot().value).toBe('Yellow');
    expect(persistedActor.actor.getSnapshot().context.count).toBe(0.75);
    persistedActor.actor.stop();
    await persistedActor.persist();
  });

  it('It should delete the persisted state', async () => {
    let persistedActor = await getPersistedActor();
    await persistedActor.delete();
    persistedActor = await getPersistedActor();
    persistedActor.actor.start();
    expect(persistedActor.actor.getSnapshot().context.count).toBe(0);
  });
});
