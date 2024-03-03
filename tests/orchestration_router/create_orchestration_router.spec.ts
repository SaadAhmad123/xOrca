import * as fs from 'fs';
import * as path from 'path';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import { Version, createOrchestrationRouter } from '../../src/index';
import { summaryStateMachine } from './orchestration_router.spec.data';
import { CloudEvent } from 'cloudevents';
import { v4 as uuidv4 } from 'uuid';
import * as zod from 'zod';
import { ILogger } from 'xorca-cloudevent-router';

describe('The orchestration router init handler specs', () => {
  const rootDir = path.join(__dirname, '.statemachine.orchestration');
  const storageManager = new LockableStorageManager({
    storageManager: new LocalFileStorageManager(rootDir).setLogger(() => {}),
  });
  const orchestratorName: string = 'summary';
  const orchestrationVersion: Version = '1.0.0';
  const params = {
    name: orchestratorName,
    description: 'This is a test machine',
    statemachine: [
      {
        version: orchestrationVersion,
        orchestrationMachine: summaryStateMachine,
      },
    ],
    storageManager,
    initialContextZodSchema: zod.object({
      bookId: zod.string().describe('The Book Id to which to react to.'),
    }),
    // logger: async (params: ILogger) =>`
    //   console.log(JSON.stringify(params, null, 2)),
  };

  const createInitEvent = (processId: string) =>
    new CloudEvent<Record<string, any>>({
      type: `xorca.${orchestratorName}.start`,
      subject: 'processInit',
      source: '/test',
      datacontenttype: 'application/cloudevents+json; charset=UTF-8',
      data: {
        processId,
        context: {
          bookId: '1223.pdf',
        },
        version: orchestrationVersion,
      },
    });

  const orchestrationRouter = createOrchestrationRouter(params);

  afterAll(() => {
    try {
      fs.rmdirSync(rootDir, { recursive: true });
    } catch (e) {
      console.error(e);
    }
  });

  it('should initiate and process if a valid event is provided', async () => {
    const processId = uuidv4();
    let responses = await orchestrationRouter.cloudevents([
      createInitEvent(processId),
    ]);
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit?.type).toBe('cmd.book.fetch');
    const subject = responses[0]?.eventToEmit?.subject || '';

    responses = await orchestrationRouter.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `evt.books.fetch.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          bookData: ['saad', 'ahmad'],
        },
      }),
    ]);
    expect(responses.length).toBe(0);

    responses = await orchestrationRouter.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `evt.book.fetch.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          bookData: ['saad', 'ahmad'],
        },
      }),
    ]);
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit?.type).toBe('cmd.gpt.summary');
    expect(responses[0].eventToEmit?.data?.content.join(',')).toBe(
      ['saad', 'ahmad'].join(','),
    );

    responses = await orchestrationRouter.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `evt.gpt.summary.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          summary: 'This is my name',
        },
      }),
    ]);
    expect(responses.length).toBe(2);
    expect(responses[0].eventToEmit?.type).toBe('cmd.regulations.compliant');
    expect(responses[1].eventToEmit?.type).toBe('cmd.regulations.grounded');

    responses = await orchestrationRouter.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `evt.regulations.compliant.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          compliant: true,
        },
      }),
    ]);
    // This is because the machine is waiting for the other parallel state to end as well
    expect(responses.length).toBe(0);

    responses = await orchestrationRouter.cloudevents([
      new CloudEvent<Record<string, any>>({
        type: `evt.regulations.grounded.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          grounded: true,
        },
      }),
    ]);
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit?.type).toBe('notif.done');
  });
});
