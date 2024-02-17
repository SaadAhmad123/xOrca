import { createOrchestrationMachine } from '../../src/create_orchestration_machine';

type TriState = 'TRUE' | 'FALSE' | 'ERRORED';

export type SummaryStateMachineContext = {
  bookId: string;
  bookData?: string[];
  summary?: string;
  grounded?: TriState;
  compliant?: TriState;
};

export const summaryStateMachine =
  createOrchestrationMachine<SummaryStateMachineContext>(
    {
      id: 'RegulatedSummaryStateMachine',
      initial: 'FetchData',
      context: ({ input }) => ({
        ...(input || {}),
        bookId: (input as any).bookId,
      }),
      states: {
        FetchData: {
          emit: 'cmd.book.fetch',
          on: {
            'evt.book.fetch.success': {
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
        'cmd.book.fetch': (id, state, { context }) => ({
          data: {
            bookId: context.bookId,
          },
        }),
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
    },
  );
