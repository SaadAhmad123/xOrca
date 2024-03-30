import * as fs from 'fs';
import * as path from 'path';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import { Version } from '../../src/index';
import { createOrchestrationInitHandler } from '../../src/orchestration_router/init_handler';
import { createOrchestrationHandler } from '../../src/orchestration_router/orchestration_handler';
import { summaryStateMachine } from './orchestration_router.spec.data';
import { CloudEvent } from 'cloudevents';
import { v4 as uuidv4 } from 'uuid';
import * as zod from 'zod';

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

  const orchestrationInitHandler = createOrchestrationInitHandler(params);
  const orchestrationHandler = createOrchestrationHandler(params);

  afterAll(() => {
    try {
      //fs.rmdirSync(rootDir, { recursive: true });
    } catch (e) {
      console.error(e);
    }
  });

  it('should process an initiated process if a valid event is provided', async () => {
    const processId = uuidv4();
    let responses = await orchestrationInitHandler.safeCloudevent(
      createInitEvent(processId),
    );
    expect(responses.length).toBe(1);

    responses = await orchestrationHandler.safeCloudevent(
      responses[0].eventToEmit,
    );
    expect(responses[0].eventToEmit.type).toBe(
      'sys.xorca.orchestrator.summary.error',
    );
    //console.log(JSON.stringify(responses, null, 2));
    const subject = responses[0]?.eventToEmit?.subject || '';
    responses = await orchestrationHandler.safeCloudevent(
      new CloudEvent<Record<string, any>>({
        type: `evt.books.fetch.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          bookData: ['saad', 'ahmad'],
        },
        executionunits: '1.5',
      }),
    );
    // The event is valid with 'evt.' prefix. However, the machine logic does not recognise the `books` bit
    expect(responses.length).toBe(0);

    responses = await orchestrationHandler.safeCloudevent(
      new CloudEvent<Record<string, any>>({
        type: `evt.book.fetch.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          bookData: ['saad', 'ahmad'],
        },
        executionunits: '1.5',
      }),
    );
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit.type).toBe('cmd.gpt.summary');
    expect(responses[0].eventToEmit.data?.content.join(',')).toBe(
      ['saad', 'ahmad'].join(','),
    );

    responses = await orchestrationHandler.safeCloudevent(
      new CloudEvent<Record<string, any>>({
        type: `evt.gpt.summary.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          summary: 'This is my name',
        },
      }),
    );
    expect(responses.length).toBe(2);
    expect(responses[0].eventToEmit.type).toBe('cmd.regulations.compliant');
    expect(responses[1].eventToEmit.type).toBe('cmd.regulations.grounded');

    responses = await orchestrationHandler.safeCloudevent(
      new CloudEvent<Record<string, any>>({
        type: `evt.regulations.compliant.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          compliant: true,
        },
      }),
    );
    // This is because the machine is waiting for the other parallel state to end as well
    expect(responses.length).toBe(0);

    responses = await orchestrationHandler.safeCloudevent(
      new CloudEvent<Record<string, any>>({
        type: `evt.regulations.grounded.success`,
        subject,
        source: '/test',
        datacontenttype: 'application/cloudevents+json; charset=UTF-8',
        data: {
          grounded: true,
        },
      }),
    );
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit.type).toBe('notif.done');
  });
});
