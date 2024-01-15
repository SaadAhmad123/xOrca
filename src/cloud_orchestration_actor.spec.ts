import * as fs from 'fs';
import * as path from 'path';

import {
  makeSubject,
  orchestrateCloudEvents,
} from './cloud_orchestration_actor';
import { SummaryStateMachineContext } from './cloud_orchestration_actor.spec.data';
import { createCloudEvent } from './utils';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import {
  OnOrchestrationState,
  IOrchestrateCloudEvents,
  Version,
} from './types';
import { CloudEvent } from 'cloudevents';
import { createMachineYaml } from './create_machine_yaml';
import { readFile } from './utils';

const orchestrationMiddleware: Record<string, OnOrchestrationState> = {
  FetchData: (id, state, { context }) => ({
    type: 'books.com.fetch',
    data: {
      bookId: context.bookId,
    },
  }),
  Summarise: (id, state, { context }) => ({
    type: 'gpt.com.summary',
    data: {
      content: context.bookData,
    },
  }),
  '#Regulate.#Grounded.Check': (id, state, { context }) => ({
    type: 'regulations.com.summaryGrounded',
    data: {
      content: context.bookData,
      summary: context.summary,
    },
  }),
  '#Regulate.#Compliant.Check': (id, state, { context }) => ({
    type: 'regulations.com.summaryCompliance',
    data: {
      content: context.summary,
    },
  }),
};

describe('Cloud Orchestration Actor Test', () => {
  const stateMachineName = 'SummaryStateMachine';
  const stateMachineVersion: Version = '0.0.1';
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
    name: stateMachineName,
    statemachine: [
      {
        version: stateMachineVersion,
        logic: summaryStateMachine,
      },
    ],
    storageManager: new LockableStorageManager({ storageManager: manager }),
    onOrchestrationState: orchestrationMiddleware,
  };

  it('should throw an error when trying to orchestrate an event for an uninitiated process', async () => {
    const { errors, eventsToEmit } = await orchestrateCloudEvents(
      orchestrationParams,
      [
        createCloudEvent({
          subject: makeSubject(
            processId,
            stateMachineName,
            stateMachineVersion,
          ),
          type: 'summaryOrchestration.evt.init',
          source: '/source/some',
          data: {},
        }),
        createCloudEvent({
          subject: processId,
          type: 'summaryOrchestration.evt.init',
          source: '/source/some',
          data: {},
        }),
      ],
    );
    expect(eventsToEmit.length).toBe(0);
    expect(errors.length).toBe(2);
    expect(errors[0].error).toBe(
      `The subject=${makeSubject(
        processId,
        stateMachineName,
        stateMachineVersion,
      )} not already initiated.`,
    );
    expect(errors[1].error).toBe(
      `[orchestrateCloudEvents][parseSubject] Invalid subject=${processId}. Error -> Unexpected token � in JSON at position 0`,
    );
  });

  it('should emit a book fetch event when initiating the orchestration process with a book ID', async () => {
    const { eventsToEmit } = await orchestrateCloudEvents(
      orchestrationParams,
      [],
      [
        {
          processId: processId,
          version: '0.0.1',
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
    const { eventsToEmit, errors } = await orchestrateCloudEvents(
      orchestrationParams,
      [
        createCloudEvent({
          type: 'books.evt.fetch.success',
          subject: processId,
          source: '/books/fetch/',
          data: {
            bookId: 'saad.pdf',
            bookData: ['saad', 'ahmad'],
          },
        }),
        createCloudEvent({
          type: 'books.evt.fetch.success',
          subject: makeSubject(
            processId,
            stateMachineName,
            stateMachineVersion,
          ),
          source: '/books/fetch/',
          data: {
            bookId: 'saad.pdf',
            bookData: ['saad', 'ahmad'],
          },
        }),
      ],
    );
    expect(errors[0].error).toBe(
      `[orchestrateCloudEvents][parseSubject] Invalid subject=${processId}. Error -> Unexpected token � in JSON at position 0`,
    );
    expect(eventsToEmit.length).toBe(1);
    expect(eventsToEmit[0].type).toBe('gpt.com.summary');
  });

  it('should throw version miss match error and datacontenttype validation error', async () => {
    const { errors } = await orchestrateCloudEvents(orchestrationParams, [
      createCloudEvent({
        type: 'gpt.evt.summary.success',
        subject: makeSubject(processId, stateMachineName, '1.0.1'),
        source: '/regulation/summaryGrounded/',
        data: {
          summary: 'Some name',
        },
      }),
      new CloudEvent(
        {
          type: 'gpt.evt.summary.success',
          subject: makeSubject(
            processId,
            stateMachineName,
            stateMachineVersion,
          ),
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

    expect(errors.length).toBe(2);
    expect(errors[0].error).toBe(
      '[orchestrateCloudEvents][getStateMachine] The state machine name=SummaryStateMachine version=1.0.1 not found. Provided versions are 0.0.1',
    );
    expect(errors[1].error).toBe(
      "[cloudevent][Invalid content type] The 'datacontenttype' must be either 'application/cloudevents+json' or 'application/json'. The given is datacontenttype=application/xml",
    );
  });

  it('should emit compliance and grounded summary events upon successful summary generation', async () => {
    const { eventsToEmit, processIdContext } = await orchestrateCloudEvents(
      orchestrationParams,
      [
        createCloudEvent({
          type: 'gpt.evt.summary.success',
          subject: makeSubject(
            processId,
            stateMachineName,
            stateMachineVersion,
          ),
          source: '/regulation/summaryGrounded/',
          data: {
            summary: 'Some name',
          },
          statemachineversion: '0.0.1',
        }),
      ],
    );
    console.log(JSON.stringify(eventsToEmit, null, 4))
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
