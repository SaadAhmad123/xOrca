import * as fs from 'fs';
import * as path from 'path';
import {
  LocalFileStorageManager,
  LockableStorageManager,
} from 'unified-serverless-storage';
import { Version } from '../../src/index';
import { createOrchestrationInitHandler } from '../../src/orchestration_router/init_handler';
import { summaryStateMachine } from './orchestration_router.spec.data';
import { v4 as uuidv4 } from 'uuid';
import { makeSubject } from '../../src/utils';
import * as zod from 'zod';
import { cleanString } from 'xorca-cloudevent-router/dist/utils';
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
  const orchestrationInitHandler = createOrchestrationInitHandler({
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
  });

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

  it('should initiate a orchestration machine and generate the init events', async () => {
    const processId = uuidv4();
    const responses = await orchestrationInitHandler.cloudevent(
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
      }),
    );
    const resp = responses[0];
    expect(resp?.eventToEmit?.type).toBe('cmd.book.fetch');
    expect(resp?.eventToEmit?.subject).toBe(
      makeSubject(processId, orchestratorName, orchestrationVersion),
    );
    expect(resp?.eventToEmit?.data?.bookId).toBe('1223.pdf');
    expect(resp?.eventToEmit?.source).toBe(
      `xorca.orchestrator.${orchestratorName}`,
    );
    expect(resp?.eventToEmit?.datacontenttype).toBe(
      'application/cloudevents+json; charset=UTF-8; profile=xorca',
    );
  });

  it('should fail on duplicate process ids as that means the first process has already started', async () => {
    const processId = uuidv4();
    await orchestrationInitHandler.cloudevent(
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
      }),
    );

    const responses = await orchestrationInitHandler.cloudevent(
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
      }),
    );

    const resp = responses[0];
    expect(resp?.eventToEmit?.type).toBe('xorca.summary.start.error');
    expect(resp?.eventToEmit?.subject).toBe(
      makeSubject(processId, orchestratorName, orchestrationVersion),
    );
    expect(resp?.eventToEmit?.data?.errorMessage).toBe(
      `An orchestration state with processId=${processId}, orchestration name=${orchestratorName} and machine version=${orchestrationVersion} already exists ==> subject=${makeSubject(processId, orchestratorName, orchestrationVersion)}`,
    );
    expect(resp?.eventToEmit?.source).toBe(
      `xorca.orchestrator.${orchestratorName}`,
    );
    expect(resp?.eventToEmit?.datacontenttype).toBe(
      'application/cloudevents+json; charset=UTF-8; profile=xorca',
    );
  });

  it('should raise a system error on back context shape', async () => {
    const processId = uuidv4();
    const responses = await orchestrationInitHandler.cloudevent(
      new XOrcaCloudEvent({
        type: `xorca.${orchestratorName}.start`,
        subject: 'processInit',
        source: '/test',
        data: {
          processId,
          context: {
            bookId2: '1223.pdf',
          },
          version: orchestrationVersion,
        },
      }),
    );
    const resp = responses[0];
    expect(resp.success).toBe(false);
    expect(resp?.eventToEmit?.type).toBe('sys.xorca.summary.start.error');
    expect(resp?.eventToEmit?.data?.errorMessage).toBe(
      cleanString(`
        [CloudEventHandler][cloudevent] Invalid handler input data.
        The response data does not match type=xorca.summary.start
        expected data shape  
      `),
    );
    expect(resp?.eventToEmit?.source).toBe(`xorca.${orchestratorName}.start`);
    expect(resp?.eventToEmit?.datacontenttype).toBe(
      'application/cloudevents+json; charset=UTF-8; profile=xorca',
    );
  });
});
