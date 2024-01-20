import { assign, createMachine } from 'xstate';

type TrafficContext = {
  count: number;
};

const trafficStateMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QBUBOBDAZpglgYwGUAXdIsAWXTwAscA7MAOgHFUww6BiACQEEAZZAG0ADAF1EoAA4B7WDiI4ZdSSAAeiAIwAWAOyMAzNoO7dATgBsFkQA4RAJhEWANCACeW3SMY2jx7QCs5lYBBjYAvuGuaFi4hCRklDT0TACaYAA2GTIA7jwCwuKqsvKKyqoaCAZmAT422mb2XtVmZsauHgiaXj5+RkGWFqERUSAx2PjEpBRUtAyM6Vm5nOQA8gBqAKKiEkggJQpKKnuVOtqMAdr2rWbm9gGOlh2I5-ZD9jYfDU66jgGR0QwE3i0yScyYACVICsNtsinsDmVjqBKiZNIxtBZjDYapoDAELKZnghXu9PvUzD8-pFRnQZBA4KpxnEpolZilinJDuUTogALS1G5C4WtAzEvm+Rj2Iy-LyEgzXaUAsZAlkJGbJeasdjI-ZcpEVF72RgiU1m81mzTEmz6AK+BXNeyOYLK5mTdVglILTLZHKc0pHQ1VET6N4mCw2awmEQGMXuRCEjG2IaE00GGOaEaA2Lu0Hs+ZQiD+7m6yoBVqMQk6ZMOBq3a22+1NGNOkNmEaRIA */
    id: 'TrafficStateMachine',
    types: {} as {
      context: TrafficContext;
    },
    context: ({ input }) => {
      const _input = input as Record<string, any>;
      return {
        count: _input.count || -1 / 4,
      } as TrafficContext;
    },
    states: {
      Green: {
        on: {
          HALT: 'Yellow',
        },
        entry: 'utils.increment',
      },
      Yellow: {
        on: {
          HALT: 'Red',
          MOVE: 'Green',
        },
        entry: 'utils.increment',
      },
      Red: {
        on: {
          MOVE: 'Yellow',
        },
        entry: 'utils.increment',
      },
    },
    initial: 'Green',
  },
  {
    actions: {
      'utils.increment': assign({
        count: ({ context, event }) => context.count + 1 / 4,
      }),
    },
  },
);

export default trafficStateMachine;
