import { createMachine } from 'xstate';
import { assignEventDataToContext } from '.';

type TriState = 'TRUE' | 'FALSE' | 'ERRORED';

export type SummaryStateMachineContext = {
  bookId: string;
  bookData?: string[];
  summary?: string;
  grounded?: TriState;
  compliant?: TriState;
};

export const summaryStateMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QCUxQK4BsCGAXSAyugLbHYBOAngbnmALLYDGAFgJYB2YAdAGJi5WAETzYAxACMA9lIDWsbmABuubgDMBrbrHRMmcWAG0ADAF1EoAA5TYbXGykcLIAB6IA7ABZuXgJwBGX3cAJgAOY2MANn9g4IAaEEpEYMiAZh9I0NCAVijU-0Dg32yAXxKE1AwcfAgiUgpqWnxGVk4efkEWEVpJGXlFFXVNFkVycilyE3MkEGtbe0dnNwRQ925jf2MA4ONg7ODU31DfBKSEbMjjbkj3d38s92PQgsiyirQsOlqSMioaOha7C43DqvzYsDAYigllUylUOnqVG0un0sCMZmcczsDicM2WN0i3H8t3c2V8nlyoQp-lOyTSPjygV85IiR1K5RAlU+NVBDX+zWYQJ4vPI4Mh0NhgwRv0oo3GkwxMyxC1xoGWnk8ayix08KV8qWC91CtPO2W8Rv8nkCOT2BrenI+1UIPz5TQYgra3C5TrEEEcPFgbq9jq+IsaAI9wO9dCmmJs2MWeMQ92yoW4Goiqc80VWxsSiE8viunmMZNCqVSzzuqXZ7yqoZdfzdgM90fw3AA4uN0BwIJBuABhFhgJiyMTkEMqhRw5GIyhdqQ9vsQZF6AyxpXxlVLZOxK6+SKZMLk9wBSLxfMIQ5ra2+YKnzZ+WsO+s8xvhgWtKOTngLpf9ocRzHCdXxxacpXfP9e37MAxgmDcrC3HEdwQGIdm4IIdiOTNiXvE1iSuctQkPYJPHyEJjFSdx7TbZ0535d0vx4WjBykYhLEwNhsA4VRANHcdJzAgZ4XfAc2I4riOH0VdUXRaZEPmZCk1QvduFSDZSI1Z5jGebITSLdJsy8aJ-ErR4axon9vno5tI2Yn9WPYzjuN44d+JA7khJnaUGjEpzJOk2D5QQ2YkMTNVd0CNTIk8YiUmyAooj0y9Mmya5UkLXJ9QebJqPtDgpD7eAZlo6yZQYlsuDjRTwtcOkfELQIQnCKI0OSs4AFoAmuaI9i2IJmWyKjLNfOjytspi+GGbpsGqhNVTqlS03cKJDWeA0Yg2E0NW8XZ70uXVNtSEbuTG10I0mkUxTm7dlMLK4Ihi-JVnvQ4zW2hKMIOGt1PUm0TqdMrzs-IVg1Gm6lIi1DdnSKlSQuHJLguSITQ681eqpdSdNJV6AYbGyLtBlioOXCHauWR9gm4fZ-AS9xIiOMIihNcs1LM-JdR2YlTLxt8CZB1sHJJgC3NkMmFopzbqcNOmGdCJmTkvfJfG4FIM3po5iVPXmzqbQnBdGztu2glchH9cWUP8S5-Gp+nvqorZ7hNZXVZisj8lLLHPB1oG9YF79Db8iSXIt5THxtuHsgRi5S0PE0yyJGsNmZIpcOfUqwwquywdOxzg54wdRdDqGCiiyPo6RuPL2eFXihSY5zwNDUfcziaiYcoPnILs2qs3GqJeTaI0soykhrNWIyJZqK67uXJfsPb2OQz98s8mgBRODyGLxbTIe+4QhSN6ck8E1SV2pvchLCkGZble289HuwG35YZZtwsYpi3LUnPGlL1itZIhR3JDWS4IQzSvDKCUIAA */
    id: 'RegulatedSummaryStateMachine',
    initial: 'FetchData',
    types: {} as {
      context: SummaryStateMachineContext;
    },
    context: ({ input }) => ({
      bookId: (input as any).bookId,
    }),
    states: {
      FetchData: {
        on: {
          'books.evt.fetch.success': {
            target: 'Summarise',
            actions: ['contextAssign'],
          },
          'books.evt.fetch.error': {
            target: 'Error',
            actions: ['contextAssign'],
          },
        },
      },
      Summarise: {
        on: {
          'gpt.evt.summary.success': {
            target: 'Regulate',
            actions: ['contextAssign'],
          },
          'gpt.evt.summary.error': {
            target: 'Error',
            actions: ['contextAssign'],
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
                on: {
                  'regulations.evt.summaryGrounded.success': {
                    target: 'Done',
                    actions: ['contextAssign'],
                  },
                  'regulations.evt.summaryGrounded.error': {
                    target: 'Done',
                    actions: ['contextAssign'],
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
                on: {
                  'regulations.evt.summaryCompliance.success': {
                    target: 'Done',
                    actions: ['contextAssign'],
                  },
                  'regulations.evt.summaryCompliance.error': {
                    target: 'Done',
                    actions: ['contextAssign'],
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
      Done: { type: 'final' },
    },
  },
  {
    actions: {
      contextAssign: assignEventDataToContext as any,
    },
  },
);
