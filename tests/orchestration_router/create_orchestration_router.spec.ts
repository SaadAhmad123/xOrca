import * as fs from 'fs';
import * as path from 'path';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import { Version, createOrchestrationRouter } from '../../src/index';
import { summaryStateMachine } from './orchestration_router.spec.data';
import { v4 as uuidv4 } from 'uuid';
import * as zod from 'zod';
import { makeSubject, parseSubject } from '../../src/utils';
import { XOrcaCloudEvent } from 'xorca-cloudevent';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import * as dotenv from 'dotenv';
dotenv.config();

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'xorca.orchestrator.test',
    [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
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
    // logger: async (params: ILogger) =>`
    //   console.log(JSON.stringify(params, null, 2)),
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

  const { router: orchestrationRouter } = createOrchestrationRouter(params);

  beforeAll(() => {
    sdk.start();
  });

  afterAll(() => {
    try {
      sdk.shutdown();
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
    const ogTp = responses[0]?.eventToEmit?.traceparent;
    responses = await orchestrationRouter.cloudevents([
      new XOrcaCloudEvent({
        type: `evt.books.fetch.success`,
        subject,
        source: '/test',
        data: {
          bookData: ['saad', 'ahmad'],
        },
        traceparent: ogTp,
      }),
    ]);
    //expect(responses.length).toBe(0);

    responses = await orchestrationRouter.cloudevents([
      new XOrcaCloudEvent({
        type: `evt.book.fetch.success`,
        subject,
        source: '/test',
        data: {
          bookData: ['saad', 'ahmad'],
        },
        traceparent: ogTp,
      }),
    ]);
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit?.type).toBe('cmd.gpt.summary');
    expect(responses[0].eventToEmit?.data?.content.join(',')).toBe(
      ['saad', 'ahmad'].join(','),
    );

    responses = await orchestrationRouter.cloudevents([
      new XOrcaCloudEvent({
        type: `evt.gpt.summary.success`,
        subject,
        source: '/test',
        data: {
          summary: 'This is my name',
        },
        traceparent: responses[0].event.traceparent,
      }),
    ]);
    expect(responses.length).toBe(2);
    expect(responses[0].eventToEmit?.type).toBe('cmd.regulations.compliant');
    expect(responses[1].eventToEmit?.type).toBe('cmd.regulations.grounded');
    const groudedTraceParent = responses[1].event.traceparent;
    responses = await orchestrationRouter.cloudevents([
      new XOrcaCloudEvent({
        type: `evt.regulations.compliant.success`,
        subject,
        source: '/test',
        data: {
          compliant: true,
        },
        traceparent: responses[0].event.traceparent,
      }),
    ]);
    // This is because the machine is waiting for the other parallel state to end as well
    expect(responses.length).toBe(0);

    const parsed = parseSubject(subject);
    responses = await orchestrationRouter.cloudevents([
      new XOrcaCloudEvent({
        type: `evt.regulations.grounded.success`,
        subject: makeSubject(
          parsed.processId,
          parsed.name + '123',
          parsed.version,
        ),
        source: '/test',
        data: {
          grounded: true,
        },
        traceparent: groudedTraceParent,
      }),
    ]);
    // Invalid name in subject
    expect(responses.length).toBe(0);

    responses = await orchestrationRouter.cloudevents([
      new XOrcaCloudEvent({
        type: `evt.regulations.grounded.success`,
        subject,
        source: '/test',
        data: {
          grounded: true,
        },
        traceparent: groudedTraceParent,
      }),
    ]);
    expect(responses.length).toBe(1);
    expect(responses[0].eventToEmit?.type).toBe('notif.done');
  });
});
