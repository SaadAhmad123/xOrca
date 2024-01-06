import * as fs from 'fs';
import * as path from 'path';

import { orchestrateCloudEvents } from './cloud_orchestration_actor';
import { SummaryStateMachineContext } from './cloud_orchestration_actor.spec.data';
import { createCloudEvent } from './utils';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import {
  CloudOrchestrationStateMiddleware,
  IOrchestrateCloudEvents,
} from './types';
import { CloudEvent } from 'cloudevents';
import { createMachineYaml } from './create_machine_yaml';
import { readFile } from './utils';

const orchestrationMiddleware: Record<
  string,
  CloudOrchestrationStateMiddleware
> = {
  FetchData: (id, state, { context }) =>
    createCloudEvent({
      type: 'books.com.fetch',
      subject: id,
      source: '/test/summary/orchestrator',
      data: {
        bookId: context.bookId,
      },
    }),
  Summarise: (id, state, { context }) =>
    createCloudEvent({
      type: 'gpt.com.summary',
      subject: id,
      source: '/test/summary/orchestrator',
      data: {
        content: context.bookData,
      },
    }),
  '#Regulate.#Grounded.Check': (id, state, { context }) =>
    createCloudEvent({
      type: 'regulations.com.summaryGrounded',
      subject: id,
      source: '/test/summary/orchestrator',
      data: {
        content: context.bookData,
        summary: context.summary,
      },
    }),
  '#Regulate.#Compliant.Check': (id, state, { context }) =>
    createCloudEvent({
      type: 'regulations.com.summaryCompliance',
      subject: id,
      source: '/test/summary/orchestrator',
      data: {
        content: context.summary,
      },
    }),
};

describe('Cloud Orchestration Actor Test', () => {
  const rootDir = path.join(__dirname, '.statemachine.orchestration');
  const processId = '3214a-dsa-32431232432';
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir);
  }
  let manager = new LocalFileStorageManager(rootDir);

  afterAll(() => {
    fs.rmdirSync(rootDir, { recursive: true });
  });

  const summaryStateMachine = createMachineYaml<SummaryStateMachineContext>(
    readFile('cloud_orchestration_actor.spec.data.yaml'),
  );
  const orchestrationParams: IOrchestrateCloudEvents<
    typeof summaryStateMachine
  > = {
    statemachine: {
      version: '0.0.1',
      logic: summaryStateMachine,
    },
    storageManager: new LockableStorageManager({ storageManager: manager }),
    onOrchestrationState: orchestrationMiddleware,
  };

  it('should throw an error when trying to orchestrate an event for an uninitiated process', async () => {
    let error: Error | undefined;
    try {
      const eventsToEmit = await orchestrateCloudEvents(orchestrationParams, [
        createCloudEvent({
          subject: processId,
          type: 'summaryOrchestration.evt.init',
          source: '/source/some',
          data: {},
        }),
      ]);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).toBe(
      `The subject=${processId} not already initiated.`,
    );
  });

  it('should emit a book fetch event when initiating the orchestration process with a book ID', async () => {
    const { eventsToEmit } = await orchestrateCloudEvents(
      orchestrationParams,
      [],
      [
        {
          subject: processId,
          context: {
            bookId: 'saad.pdf',
          },
        },
      ],
    );
    expect(eventsToEmit.length).toBe(1);
    expect(eventsToEmit[0].type).toBe('books.com.fetch');
  });

  it('should emit a summary event upon successful book data fetch', async () => {
    const { eventsToEmit } = await orchestrateCloudEvents(orchestrationParams, [
      createCloudEvent({
        type: 'books.evt.fetch.success',
        subject: processId,
        source: '/books/fetch/',
        data: {
          bookId: 'saad.pdf',
          bookData: ['saad', 'ahmad'],
        },
      }),
    ]);
    expect(eventsToEmit.length).toBe(1);
    expect(eventsToEmit[0].type).toBe('gpt.com.summary');
  });

  it('should throw version miss match error', async () => {
    let error: Error | undefined;
    try {
      await orchestrateCloudEvents(orchestrationParams, [
        createCloudEvent({
          type: 'gpt.evt.summary.success',
          subject: processId,
          source: '/regulation/summaryGrounded/',
          data: {
            summary: 'Some name',
          },
          statemachineversion: '1.0.1',
        }),
      ]);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).toBe(
      '[cloudevent][Invalid state machine version] The event expects state machine version=1.0.1, however, the state machine is version=0.0.1',
    );
  });

  it('should throw version datacontenttype validation error', async () => {
    let error: Error | undefined;
    try {
      await orchestrateCloudEvents(orchestrationParams, [
        new CloudEvent(
          {
            type: 'gpt.evt.summary.success',
            subject: processId,
            source: '/regulation/summaryGrounded/',
            data: {
              summary: 'Some name',
            },
            statemachineversion: '1.0.1',
            datacontenttype: 'application/xml',
          },
          true,
        ),
      ]);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).toBe(
      `[cloudevent][Invalid content type] The 'datacontenttype' must be either 'application/cloudevents+json' or 'application/json'. The given is datacontenttype=application/xml`,
    );
  });

  it('should emit compliance and grounded summary events upon successful summary generation', async () => {
    const { eventsToEmit, processIdContext } = await orchestrateCloudEvents(
      orchestrationParams,
      [
        createCloudEvent({
          type: 'gpt.evt.summary.success',
          subject: processId,
          source: '/regulation/summaryGrounded/',
          data: {
            summary: 'Some name',
          },
          statemachineversion: '0.0.1',
        }),
      ],
    );
    console.log(JSON.stringify({ processIdContext }, null, 2));
    expect(eventsToEmit.length).toBe(2);
    const eventToEmitTypes = eventsToEmit.map((item) => item.type);
    expect(eventToEmitTypes.includes('regulations.com.summaryGrounded')).toBe(
      true,
    );
    expect(eventToEmitTypes.includes('regulations.com.summaryCompliance')).toBe(
      true,
    );
  });
});
