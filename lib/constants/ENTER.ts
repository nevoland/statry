/**
 * Lifecycle hook key invoked when the state machine transitions into a state whose `type` differs
 * from the previous state. The hook receives the triggering `statetransition` runtime event and
 * may return a cleanup callback that runs when the state is left (via another transition or via
 * disposal).
 *
 * The hook is **not** invoked for the initial state a machine is constructed (or cloned) in,
 * since no transition has occurred. To run setup on startup, model an explicit `idle → started`
 * transition triggered by a bootstrap event.
 */
export const ENTER = Symbol("ENTER");
