[**statry**](../README.md)

***

[statry](../README.md) / StateMachine

# Class: StateMachine\<S, E, Context, M\>

Defined in: [classes/StateMachine.ts:24](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/classes/StateMachine.ts#L24)

A state machine is a computational model that represents a system with a finite number of states and transitions between those states.
The `StateMachine` class provides a way to define and manage state machines in TypeScript, allowing for the handling of events, state transitions, and context management.

## Extends

- `TypedEventEmitter`\<[`RuntimeEvent`](../type-aliases/RuntimeEvent.md)\<`M`\>\>

## Type Parameters

### S

`S` *extends* [`State`](../type-aliases/State.md) = [`State`](../type-aliases/State.md)

The type of the states in the state machine.

### E

`E` *extends* [`Event`](../type-aliases/Event.md) = [`Event`](../type-aliases/Event.md)

The type of the events that can trigger state transitions.

### Context

`Context` = `unknown`

The type of the context object that can be used to store additional data relevant to the state machine's operation.

### M

`M` *extends* `StateMachineLike` = [`StateMachineDefinition`](../type-aliases/StateMachineDefinition.md)\<`S`, `E`, `Context`\>

## Constructors

### Constructor

> **new StateMachine**\<`S`, `E`, `Context`, `M`\>(`stateMachine`, `initialState`, `context?`): `StateMachine`\<`S`, `E`, `Context`, `M`\>

Defined in: [classes/StateMachine.ts:43](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/classes/StateMachine.ts#L43)

#### Parameters

##### stateMachine

`M`

##### initialState

[`StateMachineState`](../type-aliases/StateMachineState.md)\<`M`\>

##### context?

[`StateMachineContext`](../type-aliases/StateMachineContext.md)\<`M`\>

#### Returns

`StateMachine`\<`S`, `E`, `Context`, `M`\>

#### Overrides

`TypedEventEmitter<RuntimeEvent<M>>.constructor`

## Properties

### context

> **context**: [`StateMachineContext`](../type-aliases/StateMachineContext.md)\<`M`\> \| `undefined`

Defined in: [classes/StateMachine.ts:36](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/classes/StateMachine.ts#L36)

The context of the state machine, which can be used to store additional data that is relevant to the state machine's operation. The context is passed to the event handlers of the state machine, and can be used to maintain state across transitions.

## Accessors

### state

#### Get Signature

> **get** **state**(): [`StateMachineState`](../type-aliases/StateMachineState.md)\<`M`\>

Defined in: [classes/StateMachine.ts:150](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/classes/StateMachine.ts#L150)

The current state of the state machine.

##### Returns

[`StateMachineState`](../type-aliases/StateMachineState.md)\<`M`\>

## Methods

### send()

> **send**(`event`): `void`

Defined in: [classes/StateMachine.ts:54](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/classes/StateMachine.ts#L54)

#### Parameters

##### event

[`StateMachineEvent`](../type-aliases/StateMachineEvent.md)\<`M`\>

#### Returns

`void`
