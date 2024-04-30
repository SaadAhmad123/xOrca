import * as fs from 'fs';
import * as path from 'path';
import { Version } from '../../../src/cloud_orchestration_actor/types';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import { createOrchestrationRouter } from '../../../src/orchestration_router/create_orchestration_router';
import { summaryMachineV3 } from './create_orchestration_actor_v3.spec.data';
import * as zod from 'zod';
import { CloudEvent } from 'cloudevents';

describe('V3 test', () => {
  const stateMachineName = 'SummaryStateMachine';
  const stateMachineVersion: Version = '0.0.1';
  const rootDir = path.join(__dirname, '.statemachine.orchestration');
  const processId = '3214a-dsa-32431232432';
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir);
  }
  let manager = new LocalFileStorageManager(rootDir);

  const { router, getOrchestrationEvents } = createOrchestrationRouter({
    name: stateMachineName,
    storageManager: new LockableStorageManager({
      storageManager: manager,
    }),
    statemachine: [
      {
        version: stateMachineVersion,
        orchestrationMachine: summaryMachineV3,
      },
    ],
    initialContextZodSchema: zod.object({
      bookId: zod.string(),
      llm: zod.enum(['openai', 'anthropic']),
    }),
    //logger: async (params) => console.log(params)
  });

  afterAll(() => {
    try {
      fs.rmdirSync(rootDir, { recursive: true });
    } catch (e) {
      console.error(e);
    }
  });

  it('should initiate the router', async () => {
    let response = await router.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `xorca.${stateMachineName}.start`,
        subject: 'processInit',
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          processId,
          context: {
            bookId: '1223.pdf',
            llm: 'openai',
          },
          version: stateMachineVersion,
        },
      }),
    ]);

    expect(response[0].eventToEmit?.type).toBe('cmd.fetch.books');
    expect(response[0].eventToEmit?.data?.bookId).toBe('1223.pdf');

    response = await router.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `evt.fetch.books.success`,
        subject: response[0].eventToEmit?.subject || '',
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          bookContent: ['My name is Saad Ahmad', 'I am in Australia'],
        },
      }),
    ]);

    expect(response[0].eventToEmit?.type).toBe('cmd.summary.create');
    expect(response[0].eventToEmit?.data?.content).toBe(
      ['My name is Saad Ahmad', 'I am in Australia'].join('\n'),
    );

    response = await router.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `evt.summary.create.success`,
        subject: response[0].eventToEmit?.subject || '',
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          summary: 'Name is provided',
        },
      }),
    ]);

    expect(response.length).toBe(0);
  });
});
