import { createOrchestrationMachineV3 } from '../../../src/create_orchestration_machine/v3';
import Emit from '../../../src/create_orchestration_machine/v3/Emit';
import * as zod from 'zod';
import Action from '../../../src/create_orchestration_machine/v3/Action';
import { assign } from 'xstate';
import {
  withBasicActions,
  BasicContext,
  Transition,
  Guard,
} from '../../../src';

type SummaryStateMachineContext = {
  bookId: string;
  bookData?: string[];
  summary?: string;
  llm: 'openai' | 'anthropic';
} & BasicContext;

export const summaryMachineV3 = createOrchestrationMachineV3<
  SummaryStateMachineContext,
  string
>({
  id: 'RegulatedSummaryStateMachine',
  initial: 'FetchData',
  context: ({ input }) => ({
    bookId: (input as any).bookId,
    llm: (input as any).llm,
  }),
  states: {
    FetchData: {
      emit: new Emit({
        name: "fetchBooks",
        event: 'cmd.fetch.books',
        schema: zod.object({
          bookId: zod.string(),
        }),
        handler: (id, state, { context }) => ({
          bookId: context.bookId,
        }),
      }),
      on: [
        new Transition<SummaryStateMachineContext>('evt.fetch.books.success', {
          target: 'Summarise',
          schema: zod.object({
            bookContent: zod.string().array(),
          }),
          actions: withBasicActions(
            new Action({
              name: 'assignBook',
              handler: assign(({ event, context }) => ({
                bookData: event.bookContent,
              })),
            }),
          ),
        }).guard({
          guard: new Guard({ name: 'saad', handler: () => false }),
          target: 'Summarise',
        }),
        new Transition('evt.fetch.books.error', {
          target: 'Error',
        }),
        new Transition('sys.cmd.fetch.books.error', {
          target: 'Error',
        }),
        new Transition('evt.fetch.books.timeout', {
          target: 'Error',
        }),
      ],
    },
    Summarise: {
      emit: new Emit({
        event: 'cmd.summary.create',
        schema: zod.object({
          content: zod.string(),
        }),
        handler: (id, state, { context }) => ({
          content: (context.bookData || []).join('\n'),
        }),
      }),
      on: [
        new Transition('evt.summary.create.success', {
          target: 'Done',
          schema: zod.object({
            summary: zod.string(),
          }),
          actions: withBasicActions(
            new Action({
              name: 'assignSummary',
              handler: assign(({ event, context }) => ({
                summary: event.summary,
              })),
            }),
          ),
        }),
        new Transition('evt.summary.create.error', {
          target: 'Error',
        }),
        new Transition('evt.summary.create.timeout', {
          target: 'Error',
        }),
        new Transition('sys.cmd.summary.create.error', {
          target: 'Error',
        }),
      ],
    },
    Done: { type: 'final' },
    Error: { type: 'final' },
  },
});
