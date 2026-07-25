import { EMPTY_ARRAY } from "unchangeable";

import { ENTER } from "../constants/ENTER.js";
import type {
  CleanupCallback,
  StateChangeEvent,
  StateChangeListener,
  StateMachine,
} from "../types";

/**
 * Transitions the state based on the event.
 *
 * @param stateMachine - The transition map.
 * @param state - The current state.
 * @param event - The event.
 * @returns The new state.
 */
export function transition<
  const Map extends StateMachine<any, any, any>,
  const State extends { type: keyof Map },
  const Event extends { type: keyof Map[State["type"]] },
  const Context,
>(
  stateMachine: Map,
  state: State,
  event: Event,
  context: Context,
  listeners?: readonly NoInfer<StateChangeListener<State>>[],
  cleanup?: CleanupCallback<State, State["type"], Context>,
): ReturnType<Map[State["type"]][Event["type"]]>;
export function transition<
  const Map extends StateMachine<any, any, any>,
  const State extends { type: string },
  const Event extends { type: string },
  const Context,
>(
  stateMachine: Map,
  state: State,
  event: Event,
  context: Context,
  listeners?: readonly NoInfer<StateChangeListener<State>>[],
  cleanup?: CleanupCallback<State, State["type"], Context>,
): never;
export function transition(
  stateMachine: StateMachine<any, any, any>,
  state: { type: string },
  event: { type: string },
  context: any,
  listeners: readonly StateChangeListener<any>[] = EMPTY_ARRAY,
  cleanup?: CleanupCallback<{ type: string }, { type: string }, any>,
) {
  const transitions = stateMachine[state.type];
  const nextState: { type: string } =
    transitions?.[event.type]?.(event, state, context) ?? state;
  if (nextState.type !== state.type) {
    const onEnterState = stateMachine[nextState.type]?.[ENTER];
    const listenersLength = listeners.length;
    if (cleanup == null && onEnterState == null && listenersLength === 0) {
      return nextState;
    }

    const changeEvent = {
      state: nextState,
      type: "statechange",
    } satisfies StateChangeEvent<{ type: string }>;

    cleanup?.(changeEvent, state, context);
    onEnterState?.(changeEvent, nextState, context);
    for (let i = 0; i < listenersLength; i++) {
      listeners[i]!(changeEvent);
    }
  }
  return nextState;
}
