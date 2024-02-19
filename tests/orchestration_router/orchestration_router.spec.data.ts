import { createOrchestrationMachineV2 } from '../../src/create_orchestration_machine/v2';

type TriState = 'TRUE' | 'FALSE' | 'ERRORED';

export type SummaryStateMachineContext = {
  bookId: string;
  bookData?: string[];
  summary?: string;
  grounded?: TriState;
  compliant?: TriState;
};

export const summaryStateMachine =
  createOrchestrationMachineV2<SummaryStateMachineContext>(
    {
      id: 'RegulatedSummaryStateMachine',
      initial: 'FetchData',
      context: ({ input }) => ({
        ...(input || {}),
        bookId: (input as any).bookId,
      }),
      states: {
        FetchData: {
          emit: (id, state, { context }) => ({
            type: 'cmd.book.fetch',
            data: {
              bookId: context.bookId,
            },
          }),
          on: {
            'evt.book.fetch.success': {
              transformer: false,
              target: 'Summarise',
              actions: ['updateContext', 'updateLogs'],
            },
            'books.evt.fetch.error': {
              target: 'Error',
              actions: ['updateContext', 'updateLogs'],
            },
          },
        },
        Summarise: {
          emit: 'cmd.gpt.summary',
          on: {
            'evt.gpt.summary.success': {
              target: 'Regulate',
              actions: ['updateContext', 'updateLogs'],
            },
            'evt.gpt.summary.error': {
              target: 'Error',
              actions: ['updateContext', 'updateLogs'],
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
                  emit: 'cmd.regulations.grounded',
                  on: {
                    'evt.regulations.grounded.success': {
                      transformer: 'onGroundedSuccess',
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                    'evt.regulations.grounded.error': {
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
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
                  emit: 'cmd.regulations.compliant',
                  on: {
                    'evt.regulations.compliant.success': {
                      transformer: true,
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                    'evt.regulations.compliant.error': {
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
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
        'cmd.gpt.summary': (id, state, { context }) => ({
          data: {
            content: context.bookData,
          },
        }),
        'cmd.regulations.grounded': (id, state, { context }) => ({
          data: {
            content: context.bookData,
            summary: context.summary,
          },
        }),
        'cmd.regulations.compliant': (id, state, { context }) => ({
          data: {
            content: context.summary,
          },
        }),
        onDone: (id, state, { context }) => ({
          type: 'notif.done',
          data: context,
        }),
      },
      transformers: {
        'evt.regulations.compliant.success': (event) => {
          return {
            data: {
              compliant: (event?.data?.compliant
                ? 'TRUE'
                : 'FALSE') as TriState,
            },
          };
        },
        'evt.book.fetch.success': (event) => ({
          data: event.data || {},
        }),
        onGroundedSuccess: (event) => {
          return {
            data: {
              grounded: (event?.data?.grounded ? 'TRUE' : 'FALSE') as TriState,
            },
          };
        },
      },
    },
  );
