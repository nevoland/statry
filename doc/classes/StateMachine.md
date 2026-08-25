[**statry**](../README.md)

***

[statry](../README.md) / StateMachine

# Class: StateMachine\<S, E, Context, M\>

Defined in: [classes/StateMachine.ts:24](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/classes/StateMachine.ts#L24)

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

> **new StateMachine**\<`S`, `E`, `Context`, `M`\>(`definition`, `initialState`, `context?`): `StateMachine`\<`S`, `E`, `Context`, `M`\>

Defined in: [classes/StateMachine.ts:57](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/classes/StateMachine.ts#L57)

Creates a new instance of the `StateMachine` class.

#### Parameters

##### definition

`M`

The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.

##### initialState

[`StateMachineState`](../type-aliases/StateMachineState.md)\<`M`\>

The initial state of the state machine, which is the state that the state machine will be in when it is first created.

##### context?

[`StateMachineContext`](../type-aliases/StateMachineContext.md)\<`M`\>

An optional context object that can be used to configure the state machine's behavior.

#### Returns

`StateMachine`\<`S`, `E`, `Context`, `M`\>

#### Overrides

`TypedEventEmitter<RuntimeEvent<M>>.constructor`

## Properties

### context

> **context**: [`StateMachineContext`](../type-aliases/StateMachineContext.md)\<`M`\> \| `undefined`

Defined in: [classes/StateMachine.ts:43](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/classes/StateMachine.ts#L43)

The context of the state machine, which can be used to store additional data that is relevant to the state machine's operation. The context is passed to the event handlers of the state machine, and can be used to maintain state across transitions.

## Accessors

### definition

#### Get Signature

> **get** **definition**(): `M`

Defined in: [classes/StateMachine.ts:165](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/classes/StateMachine.ts#L165)

The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.

##### Returns

`M`

***

### state

#### Get Signature

> **get** **state**(): [`StateMachineState`](../type-aliases/StateMachineState.md)\<`M`\>

Defined in: [classes/StateMachine.ts:158](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/classes/StateMachine.ts#L158)

The current state of the state machine.

##### Returns

[`StateMachineState`](../type-aliases/StateMachineState.md)\<`M`\>

## Methods

### clone()

> **clone**(): `StateMachine`\<`S`, `E`, `Context`, `M`\>

Defined in: [classes/StateMachine.ts:173](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/classes/StateMachine.ts#L173)

Creates a new instance of the `StateMachine` class with the same definition, state, and context as the current instance.

#### Returns

`StateMachine`\<`S`, `E`, `Context`, `M`\>

A new `StateMachine` instance that is a clone of the current instance.

***

### send()

> **send**(`event`): `void`

Defined in: [classes/StateMachine.ts:68](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/classes/StateMachine.ts#L68)

#### Parameters

##### event

[`StateMachineEvent`](../type-aliases/StateMachineEvent.md)\<`M`\>

#### Returns

`void`
