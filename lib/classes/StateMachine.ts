import { TypedEventEmitter } from "futurise";

import { ENTER } from "../constants/ENTER.js";
import type {
  Event,
  RuntimeEvent,
  State,
  StateMachineContext,
  StateMachineDefinition,
  StateMachineEvent,
  StateMachineState,
} from "../types";

type StateMachineLike = Record<string, Record<PropertyKey, unknown>>;

/**
 * A state machine is a computational model that represents a system with a finite number of states and transitions between those states.
 * The `StateMachine` class provides a way to define and manage state machines in TypeScript, allowing for the handling of events, state transitions, and context management.
 *
 * @template S - The type of the states in the state machine.
 * @template E - The type of the events that can trigger state transitions.
 * @template Context - The type of the context object that can be used to store additional data relevant to the state machine's operation.
 */
export class StateMachine<
  S extends State = State,
  E extends Event = Event,
  Context = unknown,
  M extends StateMachineLike = StateMachineDefinition<S, E, Context>,
> extends TypedEventEmitter<RuntimeEvent<M>> {
  /**
   * The context of the state machine, which can be used to store additional data that is relevant to the state machine's operation. The context is passed to the event handlers of the state machine, and can be used to maintain state across transitions.
   */
  context: StateMachineContext<M> | undefined;

  /**
   * The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine. This definition is used to determine how the state machine responds to events and transitions between states.
   */
  #definition: M;

  /**
   * The current state of the state machine, which represents the state that the state machine is currently in.
   */
  #state: StateMachineState<M>;

  /**
   * A cleanup function that is called when the state machine transitions to a new state. This function is returned by the `ENTER` handler of the current state, and is called with the event that triggered the transition, the new state, and the context of the state machine.
   */
  #cleanup?: StateMachineCleanup<M>;

  /**
   * Creates a new instance of the `StateMachine` class.
   *
   * @param definition - The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.
   * @param initialState - The initial state of the state machine, which is the state that the state machine will be in when it is first created.
   * @param context - An optional context object that can be used to configure the state machine's behavior.
   */
  constructor(
    definition: M,
    initialState: StateMachineState<M>,
    context?: StateMachineContext<M>,
  ) {
    super();
    this.#definition = definition;
    this.#state = initialState;
    this.context = context;
  }

  send(event: StateMachineEvent<M>) {
    const stateMachine = this.#definition;
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
      if (!this.hasListeners("ignoredevent")) {
        return;
      }
      this.dispatchEvent({
        state,
        target: this,
        timeStamp: Date.now(),
        trigger: event,
        type: "ignoredevent",
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
          ) => StateMachineCleanup<M> | void)
        | undefined;
      if (
        cleanup != null ||
        enter != null ||
        this.hasListeners("statetransition")
      ) {
        const stateMachineEvent = {
          previousState: state,
          state: nextState,
          target: this,
          timeStamp: Date.now(),
          trigger: event,
          type: "statetransition",
        } satisfies Extract<RuntimeEvent<M>, { type: "statetransition" }>;

        cleanup?.(stateMachineEvent, nextState, context);
        this.#cleanup =
          enter?.(stateMachineEvent, nextState, context) ?? undefined;

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
      previousState: state,
      state: nextState,
      target: this,
      timeStamp: Date.now(),
      trigger: event,
      type: "selftransition",
    });
  }

  /**
   * The current state of the state machine.
   */
  get state() {
    return this.#state;
  }

  /**
   * The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.
   */
  get definition() {
    return this.#definition;
  }

  /**
   * Creates a new instance of the `StateMachine` class with the same definition, state, and context as the current instance.
   * @returns A new `StateMachine` instance that is a clone of the current instance.
   */
  clone(): StateMachine<S, E, Context, M> {
    return new StateMachine(this.#definition, this.#state, this.context);
  }
}

type StateMachineCleanup<M extends StateMachineLike> = (
  event: RuntimeEvent<M>,
  state: StateMachineState<M>,
  context: StateMachineContext<M>,
) => void;
