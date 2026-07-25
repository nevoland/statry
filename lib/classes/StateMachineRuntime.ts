import { ENTER } from "../constants/ENTER";
import type {
  StateMachineContext,
  StateMachineEvent,
  StateMachineState,
  RuntimeEventListener,
  CleanupCallback,
  RuntimeEventType,
  RuntimeEvent,
} from "../types";

type RuntimeStateMachine = Record<string, Record<PropertyKey, unknown>>;

type RuntimeState<Map extends RuntimeStateMachine> = StateMachineState<Map>;
type RuntimeEventTrigger<Map extends RuntimeStateMachine> =
  StateMachineEvent<Map>;
type RuntimeContext<Map extends RuntimeStateMachine> = StateMachineContext<Map>;

type RuntimeStateMachineEvent<Map extends RuntimeStateMachine> = RuntimeEvent<
  RuntimeState<Map>,
  RuntimeEventTrigger<Map>,
  RuntimeContext<Map>
>;

export class StateMachineRuntime<Map extends RuntimeStateMachine> {
  #stateMachine: Map;
  #state: RuntimeState<Map>;

  context: RuntimeContext<Map> | undefined;

  #listeners?: Partial<
    Record<
      RuntimeEventType,
      RuntimeEventListener<
        RuntimeState<Map>,
        RuntimeEventTrigger<Map>,
        RuntimeContext<Map>
      >[]
    >
  >;
  #cleanup?: CleanupCallback<
    RuntimeState<Map>,
    RuntimeEventTrigger<Map>,
    RuntimeContext<Map>
  >;

  constructor(
    stateMachine: Map,
    initialState: RuntimeState<Map>,
    context?: RuntimeContext<Map>,
  ) {
    this.#stateMachine = stateMachine;
    this.#state = initialState;
    this.context = context;
  }

  get state() {
    return this.#state;
  }

  dispatchEvent(event: RuntimeEventTrigger<Map>) {
    const stateMachine = this.#stateMachine;
    const transitions = stateMachine[this.#state.type as keyof Map & string];
    const state = this.#state;
    const handler =
      transitions?.[event.type as keyof typeof transitions & string];

    if (handler == null) {
      const listeners = this.#listeners?.["ignoredevent"];
      const listenersLength = listeners?.length ?? 0;
      if (listenersLength === 0) {
        return;
      }
      const stateMachineEvent: RuntimeStateMachineEvent<Map> = {
        state,
        type: "ignoredevent",
        trigger: event,
        target: this,
        timeStamp: Date.now(),
      };
      for (let i = 0; i < listenersLength; i++) {
        listeners![i]!(stateMachineEvent);
      }
      return;
    }

    const context = this.context as RuntimeContext<Map>;
    const nextState =
      (
        handler as (
          event: RuntimeEventTrigger<Map>,
          state: RuntimeState<Map>,
          context: RuntimeContext<Map>,
        ) => RuntimeState<Map>
      )(event, state, context) ?? state;

    if (nextState.type !== state.type) {
      const cleanup = this.#cleanup;
      const onEnterState = stateMachine[nextState.type as keyof Map & string]?.[
        ENTER
      ] as
        | ((
            event: RuntimeStateMachineEvent<Map>,
            state: RuntimeState<Map>,
            context: RuntimeContext<Map>,
            dispatchEvent: (event: RuntimeEventTrigger<Map>) => void,
          ) => CleanupCallback<
            RuntimeState<Map>,
            RuntimeEventTrigger<Map>,
            RuntimeContext<Map>
          > | void)
        | undefined;
      const listeners = this.#listeners?.["statetransition"];
      const listenersLength = listeners?.length ?? 0;
      if (cleanup != null || onEnterState != null || listenersLength > 0) {
        const stateMachineEvent: RuntimeStateMachineEvent<Map> = {
          state: nextState,
          type: "statetransition",
          trigger: event,
          target: this,
          timeStamp: Date.now(),
          previousState: state,
        };

        cleanup?.(stateMachineEvent, nextState, context);
        this.#cleanup =
          onEnterState?.(
            stateMachineEvent,
            nextState,
            context,
            (nextEvent: RuntimeEventTrigger<Map>) =>
              this.dispatchEvent(nextEvent),
          ) ?? undefined;

        for (let i = 0; i < listenersLength; i++) {
          listeners![i]!(stateMachineEvent);
        }
      } else {
        this.#cleanup = undefined;
      }
      this.#state = nextState;
      return;
    }

    if (nextState !== state) {
      this.#state = nextState;
    }

    const listeners = this.#listeners?.["selftransition"];
    const listenersLength = listeners?.length ?? 0;
    if (listenersLength === 0) {
      return;
    }
    const stateMachineEvent: RuntimeStateMachineEvent<Map> = {
      state: nextState,
      type: "selftransition",
      trigger: event,
      target: this,
      timeStamp: Date.now(),
      previousState: state,
    };
    for (let i = 0; i < listenersLength; i++) {
      listeners![i]!(stateMachineEvent);
    }
  }

  addEventListener(
    eventType: RuntimeEventType,
    listener: RuntimeEventListener<
      RuntimeState<Map>,
      RuntimeEventTrigger<Map>,
      RuntimeContext<Map>
    > | null,
  ) {
    if (listener == null) {
      return;
    }
    if (this.#listeners == null) {
      this.#listeners = {};
    }
    if (!(eventType in this.#listeners)) {
      this.#listeners[eventType] = [];
    }
    this.#listeners[eventType]?.push(listener);
  }

  removeEventListener(
    eventType: RuntimeEventType,
    listener: RuntimeEventListener<
      RuntimeState<Map>,
      RuntimeEventTrigger<Map>,
      RuntimeContext<Map>
    >,
  ) {
    if (this.#listeners == null) {
      return;
    }
    if (!(eventType in this.#listeners)) {
      return;
    }
    const listeners = this.#listeners[eventType]!;
    const index = listeners.indexOf(listener);
    if (index === -1) {
      return;
    }
    listeners.splice(index, 1);
  }
}
