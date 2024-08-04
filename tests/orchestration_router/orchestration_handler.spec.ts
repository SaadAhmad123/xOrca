import * as path from 'path';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import { Version } from '../../src/index';
import { createOrchestrationInitHandler } from '../../src/orchestration_router/init_handler';
import { createOrchestrationHandler } from '../../src/orchestration_router/orchestration_handler';
import { summaryStateMachine } from './orchestration_router.spec.data';
import { v4 as uuidv4 } from 'uuid';
import * as zod from 'zod';
import { XOrcaCloudEvent } from 'xorca-cloudevent';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'orchestrator_init',
  }),
  traceExporter: new ConsoleSpanExporter(),
});

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
    new XOrcaCloudEvent({
      type: `xorca.${orchestratorName}.start`,
      subject: 'processInit',
      source: '/test',
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

  beforeAll(() => {
    sdk.start();
  });

  afterAll(() => {
    try {
      sdk.shutdown();
      //fs.rmdirSync(rootDir, { recursive: true });
    } catch (e) {
      console.error(e);
    }
  });

  it('should process an initiated process if a valid event is provided', async () => {
    const processId = uuidv4();
    let responses = await orchestrationInitHandler.cloudevent(
      createInitEvent(processId),
    );
    expect(responses.length).toBe(1);
    const ogTraceparent = responses[0].eventToEmit.traceparent;

    responses = await orchestrationHandler.cloudevent(responses[0].eventToEmit);
    expect(responses[0].eventToEmit.type).toBe(
      'sys.xorca.orchestrator.summary.error',
    );
    //console.log(JSON.stringify(responses, null, 2));
    const subject = responses[0]?.eventToEmit?.subject || '';
    responses = await orchestrationHandler.cloudevent(
      new XOrcaCloudEvent({
        type: `evt.books.fetch.success`,
        subject,
        source: '/test',
        data: {
          bookData: ['saad', 'ahmad'],
        },
        executionunits: '1.5',
        traceparent: ogTraceparent,
      }),
    );
    // The event is valid with 'evt.' prefix. However, the machine logic does not recognise the `books` bit
    expect(responses.length).toBe(0);

    responses = await orchestrationHandler.cloudevent(
      new XOrcaCloudEvent({
        type: `evt.book.fetch.success`,
        subject,
        source: '/test',
        data: {
          bookData: ['saad', 'ahmad'],
        },
        executionunits: '1.5',
        traceparent: ogTraceparent,
      }),
    );
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit.type).toBe('cmd.gpt.summary');
    expect(responses[0].eventToEmit.data?.content.join(',')).toBe(
      ['saad', 'ahmad'].join(','),
    );

    responses = await orchestrationHandler.cloudevent(
      new XOrcaCloudEvent({
        type: `evt.gpt.summary.success`,
        subject,
        source: '/test',
        data: {
          summary: 'This is my name',
        },
      }),
    );
    expect(responses.length).toBe(2);
    expect(responses[0].eventToEmit.type).toBe('cmd.regulations.compliant');
    expect(responses[1].eventToEmit.type).toBe('cmd.regulations.grounded');

    responses = await orchestrationHandler.cloudevent(
      new XOrcaCloudEvent<Record<string, any>>({
        type: `evt.regulations.compliant.success`,
        subject,
        source: '/test',
        data: {
          compliant: true,
        },
      }),
    );
    // This is because the machine is waiting for the other parallel state to end as well
    expect(responses.length).toBe(0);

    responses = await orchestrationHandler.cloudevent(
      new XOrcaCloudEvent<Record<string, any>>({
        type: `evt.regulations.grounded.success`,
        subject,
        source: '/test',
        data: {
          grounded: true,
        },
      }),
    );
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit.type).toBe('notif.done');
  });
});
