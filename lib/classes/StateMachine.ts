import { TypedEventEmitter } from "futurise";

import { ENTER } from "../constants/ENTER.js";
import type { CleanupCallback, Definition, Event, State } from "../types";
import type { RuntimeEventInternal } from "../types/RuntimeEvent.js";

/**
 * A state machine is a computational model that represents a system with a finite number of states and transitions between those states.
 * The `StateMachine` class provides a way to define and manage state machines in TypeScript, allowing for the handling of events, state transitions, and context management.
 *
 * @template S - The type of the states in the state machine.
 * @template E - The type of the events that can trigger state transitions.
 * @template Context - The type of the context object that can be used to store additional data relevant to the state machine's operation.
 */
export class StateMachine<
  S extends State,
  E extends Event,
  const Context = unknown,
> extends TypedEventEmitter<RuntimeEventInternal<S, E, Context>> {
  /**
   * The context of the state machine, which can be used to store additional data that is relevant to the state machine's operation. The context is passed to the event handlers of the state machine, and can be used to maintain state across transitions.
   */
  context: Context | undefined;

  /**
   * The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine. This definition is used to determine how the state machine responds to events and transitions between states.
   */
  #definition: Definition<S, E, Context>;

  /**
   * The current state of the state machine, which represents the state that the state machine is currently in.
   */
  #state: S;

  /**
   * A cleanup function that is called when the state machine transitions to a new state. This function is returned by the `ENTER` handler of the current state, and is called with the event that triggered the transition, the new state, and the context of the state machine.
   */
  #cleanup?: CleanupCallback<S, E, Context>;

  /**
   * Creates a new instance of the `StateMachine` class.
   *
   * @param definition - The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.
   * @param initialState - The initial state of the state machine, which is the state that the state machine will be in when it is first created.
   * @param context - An optional context object that can be used to configure the state machine's behavior.
   */
  constructor(
    definition: Definition<S, E, Context>,
    initialState: NoInfer<S>,
    context?: Context,
  ) {
    super();
    this.#definition = definition;
    this.#state = initialState;
    this.context = context;
    this.send = (event: E) => this.#send(event);
  }

  /**
   * Sends an event to the state machine, triggering any matching transition defined for the
   * current state. Bound to the instance so it can be passed as a callback.
   *
   * @param event - The event to dispatch.
   */
  send: (event: E) => void;

  #send(event: E) {
    const definition = this.#definition;
    const transitions =
      definition[this.#state.type as keyof typeof definition & string];
    const state = this.#state;
    const handler =
      transitions?.[event.type as keyof typeof transitions & string];

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

    const { context } = this;
    const nextState =
      (handler as StateEventHandler<S, E, Context>)(event, state, context) ??
      state;

    if (nextState.type !== state.type) {
      const cleanup = this.#cleanup;
      const enter =
        definition[nextState.type as keyof typeof definition & string]?.[ENTER];
      if (
        cleanup != null ||
        enter != null ||
        this.hasListeners("statetransition")
      ) {
        const transitionEvent = {
          previousState: state,
          state: nextState,
          target: this,
          timeStamp: Date.now(),
          trigger: event,
          type: "statetransition",
        } as const;

        cleanup?.(transitionEvent, nextState, context);
        this.#cleanup =
          (enter as StateEnterHandler<S, E, Context>)?.(
            transitionEvent,
            nextState,
            context,
          ) ?? undefined;

        this.dispatchEvent(transitionEvent);
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
  clone(): StateMachine<S, E, Context> {
    return new StateMachine(this.#definition, this.#state, this.context);
  }
}

type StateEventHandler<S extends State, E extends Event, Context> = (
  event: E,
  state: S,
  context?: Context,
) => S;

type StateEnterHandler<S extends State, E extends Event, Context> = (
  event: RuntimeEventInternal<S, E, Context>,
  state: S,
  context?: Context,
) => CleanupCallback<S, E, Context> | undefined;
