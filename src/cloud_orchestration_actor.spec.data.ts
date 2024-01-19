import { assignEventDataToContext } from './utils';
import { createOrchestrationMachine } from './create_orchestration_machine';

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
      /** @xstate-layout N4IgpgJg5mDOIC5QCUxQK4BsCGAXSAyugLbHYBOAngbnmALLYDGAFgJYB2YAdAGJi5WAETzYAxACMA9lIDWsbmABuubgDMBrbrHRMmcWAG0ADAF1EoAA5TYbXGykcLIAB6IALACZ33YwHZjAGY-AE4ARgBWTz8I9wAOPwAaEEpETwA2Hwy4uOMw709jT084iIBfMuTUDBx8CCJSCmpafEZWTh5+QRYRWkkZeUUVdU0WRXJyKXITcyQQa1t7R2c3BG9A3wTcqPSw0MD3COTUhHd0iO4QzxDA8JCQ92MI-IqqtCw6epIyKho6NvYXG4DR+bFgYDEUEsqmUqh0jSo2l0+lgRjMzgWdgcTjmqz8wW4nny+LinmCYXSniOKTSmUJ6S2pS8t0CB1eIGqHzqIKaf1azEBPB55DBEKhMOG8J+lHGk2m6LmmKWONAqwi6u4fkpEQeYXCxnSgWpJzOFyuNzuDye+UC7M5tUI315LQYAo63HtdDEEEcPFgLo97wdXwRzX+bqBnvwMwxNixy1xiDCpTi3HcjyecTOyb8cWOHhCxjTTxCcVZcT2YSNdqDn2FYf57Ujtfw3AA4pN0BwIJBuABhFhgJiyMTkFvYhSwpGhjtSLs9iBIvQGGOKuPKlZJ4phTV+MLGJ7uB7XKn5hDBEKEwsZCJxTJXCLVyocluO0N811NnhRniz+e9gchxHMcajwCchjhJ0qD-btezACYplXKx12xTcEHyPVLj8IkiRCZ5SgyM9Cj8bhclLJ5jDOdxAiKdIa1A7koIbT9BUDBieD7KRiEsTA2GwDhVEA4dR3HRxJ0lJjOO43j+P0JcUTRWZkMWVDE3QokfACM5smojJ4jPXIfHSYwQgZO8In8c56K5N9pQ-AF3R-fsuJ4viBP7QdhJArlwKnKUmik1zZJ4eC5SQ+YUITVUtwOTUiSrUl0j3aJAjPTILmwhlImwg9jDvCpnw4KQe3gOYfxDOyXQcrhYxUqLXCTPDNlzJ4Mj2G5DjPABaWJuHSa8ihMo8Dl2azg3reyI06UZemwWr4xVBq1izTUy2JaIdlvIiEkJQ5AkyTJkyNTwxrrJjJq-YEoNFeaNzUnVUwCPI9i1dVvGNRBAgrQlAjCKttJw29TsY98qqmtibNu1TovQoosiS9aSn8HIz0CTxSJM0J0yeYz-HKZ9yomsHLqcmCFyh+rVn3bDuCiSI9n60lSRCM98iLGiQlCPYcj8dwAjognXwq51wxJ19207WDFyE2QKcWqm2dpolni1UsSmuVHML0x5VYrPxQmB2yRcbVjSclhduCEX05bQik8lprUyVZAJwjzGlzy1zJqN+p4aMow3hd+YnTfFwKZIEm21Op9GMmS7CkdzN2TnVVNigZOHKTR2IA6J0WQ-Y5zpLcwTPNltc6vlpNFdjxHckTs9efSDGSx2P7WRz87g8c0OXPD1QrZq8uFtt3YLkOU0Iky7xzgbs5m8pA0GSpbPBfYwPmOqngAFEEPISOYazdH71idM-sy1L3cny8EhohIgk5o8-A70G8-dAewH3pa9VKelsl+3NWT7TPPEEi5wdTUQiMZbCK8KhAA */
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
              actions: ['updateContext'],
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
              actions: ['updateContext'],
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
    },
  );
