import { createOrchestrationMachineV2 } from '../../src/create_orchestration_machine/v2';
import * as zod from 'zod';

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
          eventSchema: {
            type: 'cmd.book.fetch',
            data: zod.object({
              bookId: zod.string(),
            }),
          },
          emit: (id, state, { context }) => ({
            type: 'cmd.book.fetch',
            data: {
              bookId: context.bookId,
            },
          }),
          on: {
            'evt.book.fetch.success': {
              eventSchema: {
                data: zod.object({
                  bookData: zod.string().array(),
                }),
              },
              transformer: false,
              target: 'Summarise',
              actions: ['updateContext', 'updateLogs'],
            },
            'books.evt.fetch.error': {
              eventSchema: {
                data: zod.object({
                  bookData: zod.string().array(),
                }),
              },
              target: 'Error',
              actions: ['updateContext', 'updateLogs'],
            },
          },
        },
        Summarise: {
          emit: 'cmd.gpt.summary',
          eventSchema: {
            type: 'cmd.gpt.summary',
            data: zod.object({
              content: zod.string().array(),
            }),
          },
          on: {
            'evt.gpt.summary.success': {
              eventSchema: {
                data: zod.object({
                  summary: zod.string(),
                }),
              },
              target: 'Regulate',
              actions: ['updateContext', 'updateLogs'],
            },
            'evt.gpt.summary.error': {
              eventSchema: {
                data: zod.object({
                  error: zod.string(),
                }),
              },
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
                  eventSchema: {
                    type: 'cmd.regulations.grounded',
                    data: zod.object({
                      content: zod.string().array(),
                      summary: zod.string(),
                    }),
                  },
                  on: {
                    'evt.regulations.grounded.success': {
                      transformer: 'onGroundedSuccess',
                      eventSchema: {
                        type: 'evt.regulations.grounded.success',
                        data: zod.object({
                          grounded: zod.boolean(),
                        }),
                      },
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                    'evt.regulations.grounded.error': {
                      eventSchema: {
                        type: 'evt.regulations.grounded.error',
                        data: zod.object({
                          error: zod.string(),
                        }),
                      },
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
                  eventSchema: {
                    type: 'cmd.regulations.compliant',
                    data: zod.object({
                      content: zod.string().array(),
                      summary: zod.string(),
                    }),
                  },
                  on: {
                    'evt.regulations.compliant.success': {
                      transformer: true,
                      eventSchema: {
                        type: 'evt.regulations.compliant.success',
                        data: zod.object({
                          content: zod.string().array(),
                          summary: zod.string(),
                        }),
                      },
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                    'evt.regulations.compliant.error': {
                      eventSchema: {
                        type: 'evt.regulations.compliant.error',
                        data: zod.object({
                          error: zod.string(),
                        }),
                      },
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
