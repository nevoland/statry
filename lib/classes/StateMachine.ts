import { TypedEventEmitter } from "futurise";

import type {
  Event,
  RuntimeEvent,
  State,
  StateMachineDefinition,
  StateMachineContext,
  StateMachineEvent,
  StateMachineState,
} from "../types";
import { ENTER } from "../constants/ENTER";

type StateMachineLike = Record<string, Record<PropertyKey, unknown>>;

export class StateMachine<
  S extends State = State,
  E extends Event = Event,
  Context = unknown,
  M extends StateMachineLike = StateMachineDefinition<S, E, Context>,
> extends TypedEventEmitter<RuntimeEvent<M>> {
  #stateMachine: M;
  #state: StateMachineState<M>;

  context: StateMachineContext<M> | undefined;

  #cleanup?: StateMachineCleanup<M>;

  constructor(
    stateMachine: M,
    initialState: StateMachineState<M>,
    context?: StateMachineContext<M>,
  ) {
    super();
    this.#stateMachine = stateMachine;
    this.#state = initialState;
    this.context = context;
  }

  send(event: StateMachineEvent<M>) {
    const stateMachine = this.#stateMachine;
    const transitions =
      stateMachine[this.#state.type as keyof typeof stateMachine & string];
    const state = this.#state;
    const handler = transitions?.[
      event.type as keyof typeof transitions & string
    ] as
      | ((
          event: StateMachineEvent<M>,
          state: StateMachineState<M>,
          context: StateMachineContext<M>,
        ) => StateMachineState<M> | void)
      | undefined;

    if (handler == null) {
      if (this.hasListeners("ignoredevent")) {
        return;
      }
      this.dispatchEvent({
        type: "ignoredevent",
        state,
        trigger: event,
        target: this,
        timeStamp: Date.now(),
      });
      return;
    }

    const context = this.context as StateMachineContext<M>;
    const nextState = handler(event, state, context) ?? state;

    if (nextState.type !== state.type) {
      const cleanup = this.#cleanup;
      const enter = (
        stateMachine[nextState.type as keyof typeof stateMachine & string] as
          Record<PropertyKey, unknown> | undefined
      )?.[ENTER] as
        | ((
            event: Extract<RuntimeEvent<M>, { type: "statetransition" }>,
            state: StateMachineState<M>,
            context: StateMachineContext<M>,
            send: (event: StateMachineEvent<M>) => void,
          ) => StateMachineCleanup<M> | void)
        | undefined;
      if (
        cleanup != null ||
        enter != null ||
        this.hasListeners("statetransition")
      ) {
        const stateMachineEvent = {
          type: "statetransition",
          state: nextState,
          trigger: event,
          target: this,
          timeStamp: Date.now(),
          previousState: state,
        } satisfies Extract<RuntimeEvent<M>, { type: "statetransition" }>;

        cleanup?.(stateMachineEvent, nextState, context);
        this.#cleanup =
          enter?.(
            stateMachineEvent,
            nextState,
            context,
            (nextEvent: StateMachineEvent<M>) => this.send(nextEvent),
          ) ?? undefined;

        this.dispatchEvent(stateMachineEvent);
      } else {
        this.#cleanup = undefined;
      }
      this.#state = nextState;
      return;
    }

    if (nextState !== state) {
      this.#state = nextState;
    }

    if (!this.hasListeners("selftransition")) {
      return;
    }
    this.dispatchEvent({
      type: "selftransition",
      state: nextState,
      trigger: event,
      target: this,
      timeStamp: Date.now(),
      previousState: state,
    });
  }

  /**
   * The current state of the state machine.
   */
  get state() {
    return this.#state;
  }
}

type StateMachineCleanup<M extends StateMachineLike> = (
  event: RuntimeEvent<M>,
  state: StateMachineState<M>,
  context: StateMachineContext<M>,
) => void;
