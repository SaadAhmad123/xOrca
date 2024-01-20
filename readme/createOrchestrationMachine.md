# Function `createOrchestrationMachine`

```typescript
/**
 * Creates an orchestration state machine tailored for short-lived serverless environments.
 * The returned machine is intended for execution by the CloudOrchestrationActor.
 * It adheres to the State Machine defined in [XState Documentation](https://xstate.js.org/docs/), 
 * with limitations on invoke and delay functionality, achievable through a microservice in a serverless fleet.
 *
 * @template TContext - The type of the machine context.
 * @param {Object} config - Configuration object for the state machine.
 * @param {Object} [options] - Additional options for configuring the state machine.
 * @returns {{
 *   machine: StateMachine<TContext, any, ...>;
 *   onOrchestrationEvent: Record<string, OnOrchestrationEvent>;
 *   onOrchestrationState: Record<string, OnOrchestrationState>;
 * }}
 */
createOrchestrationMachine<TContext>(config: any, options?: any): {
    machine: StateMachine<TContext, any, ...>;
    onOrchestrationEvent: Record<string, OnOrchestrationEvent>;
    onOrchestrationState: Record<string, OnOrchestrationState>;
} 
```

For detailed information, refer to the [Typedocs](https://saadahmad123.github.io/xOrca/functions/createOrchestrationMachine.html).

This function generates an orchestration state machine optimized for execution in ephemeral serverless environments. The resulting machine is designed to be utilized by the CloudOrchestrationActor. It conforms to the State Machine specifications detailed in the [XState Documentation](https://stately.ai/docs), with certain limitations on `invoke` and `delay` functionality. These functionalities can be achieved through a dedicated microservice within a serverless fleet.


> Note: The machine comes pre-loaded with two actions: `updateContext`, which takes event data and upserts it into the machine context, and `updateLogs`, which appends logs to the context under the field named `__machineLogs`. It is recommended to use these in events.

## Example 
```typescript 
const machine = createOrchestrationMachine<{bookId: string}>({
    id: 'RegulatedSummaryStateMachine',
    initial: 'FetchData',
    context: ({ input }) => ({
        bookId: (input as any).bookId,
    }),
    states: {
        FetchData: {
          emit: 'onFetchData',
          on: {
            'books.evt.fetch.success': {
              target: 'Summarise',
              actions: ['updateContext', 'updateLogs'],
            },
            'books.evt.fetch.error': {
              target: 'Error',
              actions: ['updateContext'],
            },
          },
        },
        Summarise: {
          emit: 'onSummarise',
          on: {
            'gpt.evt.summary.success': {
              target: 'Regulate',
              transform: 'onSummarySuccessTransformer'
              actions: ['updateContext', 'someAction'],
            },
            'gpt.evt.summary.error': {
              target: 'Error',
              actions: ['updateContext'],
            },
          },
        },
        Regulate: {
          type: 'parallel',
          states: {
            Grounded: {
              initial: 'Check',
              states: {
                Check: {
                  emit: 'onRegulationGroudedCheck',
                  on: {
                    'regulations.evt.summaryGrounded.success': {
                      target: 'Done',
                      actions: ['updateContext'],
                    },
                    'regulations.evt.summaryGrounded.error': {
                      target: 'Done',
                      actions: ['updateContext'],
                    },
                  },
                },
                Done: { type: 'final' },
              },
            },
            Compliant: {
              initial: 'Check',
              states: {
                Check: {
                  emit: 'onRegulationCompliantCheck',
                  on: {
                    'regulations.evt.summaryCompliance.success': {
                      target: 'Done',
                      actions: ['updateContext'],
                    },
                    'regulations.evt.summaryCompliance.error': {
                      target: 'Done',
                      actions: ['updateContext'],
                    },
                  },
                },
                Done: { type: 'final' },
              },
            },
          },
          onDone: { target: 'Done' },
        },
        Error: { type: 'final' },
        Done: { type: 'final', emit: 'onDone' },
      },
    },
    {
      emits: {
        onFetchData: (id, state, { context }) => ({
          type: 'books.com.fetch',
          data: {
            bookId: context.bookId,
          },
        }),
        onSummarise: (id, state, { context }) => ({
          type: 'gpt.com.summary',
          data: {
            content: context.bookData,
          },
        }),
        onRegulationGroudedCheck: (id, state, { context }) => ({
          type: 'regulations.com.summaryGrounded',
          data: {
            content: context.bookData,
            summary: context.summary,
          },
        }),
        onRegulationCompliantCheck: (id, state, { context }) => ({
          type: 'regulations.com.summaryCompliance',
          data: {
            content: context.summary,
          },
        }),
        onDone: (id, state, { context }) => ({
          type: 'orch.done',
          data: context,
        }),
      },
      transforms: {
        onSummarySuccessTransformer: (event: CloudEvent<Record<string, any>>) => ({
            summary: event?.data?.summary,
        })
      },
      actions: {
        someAction: (...args) => {console.log({..args})}
      }
    },
});
```

This example showcases the creation of a state machine for orchestrating activities related to book data processing. The machine includes various states, transitions, emits, transforms, and actions to facilitate the orchestration process.