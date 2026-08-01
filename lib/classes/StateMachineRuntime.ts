import { TypedEventEmitter } from "futurise";

import type {
  CleanupCallback,
  Event,
  RuntimeEvent,
  State,
  StateMachine,
  StateMachineContext,
  StateMachineEvent,
  StateMachineState,
} from "../types";
import { ENTER } from "../constants/ENTER";

export class StateMachineRuntime<
  M extends StateMachine<State, Event, any>,
> extends TypedEventEmitter<RuntimeEvent<M>> {
  #stateMachine: M;
  #state: StateMachineState<M>;

  context: StateMachineContext<M> | undefined;

  #cleanup?: CleanupCallback<
    StateMachineState<M>,
    StateMachineEvent<M>,
    StateMachineContext<M>
  >;

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
    const transitions = stateMachine[this.#state.type as keyof M & string];
    const state = this.#state;
    const handler =
      transitions?.[event.type as keyof typeof transitions & string];

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

    const { context } = this;
    const nextState = handler(event, state, context!) ?? state;

    if (nextState.type !== state.type) {
      const cleanup = this.#cleanup;
      const enter = stateMachine[nextState.type as keyof M & string]?.[ENTER];
      if (
        cleanup != null ||
        enter != null ||
        this.hasListeners("statetransition")
      ) {
        const stateMachineEvent: RuntimeEvent<M> = {
          type: "statetransition",
          state: nextState,
          trigger: event,
          target: this,
          timeStamp: Date.now(),
          previousState: state,
        };

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

  get state() {
    return this.#state;
  }
}
