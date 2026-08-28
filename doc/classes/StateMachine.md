[**statry**](../README.md)

***

[statry](../README.md) / StateMachine

# Class: StateMachine\<S, E, Context\>

Defined in: [classes/StateMachine.ts:15](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/classes/StateMachine.ts#L15)

A state machine is a computational model that represents a system with a finite number of states and transitions between those states.
The `StateMachine` class provides a way to define and manage state machines in TypeScript, allowing for the handling of events, state transitions, and context management.

## Extends

- `TypedEventEmitter`\<`RuntimeEventInternal`\<`S`, `E`, `Context`\>\>

## Type Parameters

### S

`S` *extends* [`State`](../type-aliases/State.md)

The type of the states in the state machine.

### E

`E` *extends* [`Event`](../type-aliases/Event.md)

The type of the events that can trigger state transitions.

### Context

`Context` = `unknown`

The type of the context object that can be used to store additional data relevant to the state machine's operation.

## Constructors

### Constructor

> **new StateMachine**\<`S`, `E`, `Context`\>(`definition`, `initialState`, `context?`): `StateMachine`\<`S`, `E`, `Context`\>

Defined in: [classes/StateMachine.ts:47](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/classes/StateMachine.ts#L47)

Creates a new instance of the `StateMachine` class.

#### Parameters

##### definition

[`Definition`](../type-aliases/Definition.md)\<`S`, `E`, `Context`\>

The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.

##### initialState

`NoInfer`\<`S`\>

The initial state of the state machine, which is the state that the state machine will be in when it is first created.

##### context?

`Context`

An optional context object that can be used to configure the state machine's behavior.

#### Returns

`StateMachine`\<`S`, `E`, `Context`\>

#### Overrides

`TypedEventEmitter<RuntimeEventInternal<S, E, Context>>.constructor`

## Properties

### context

> **context**: `Context` \| `undefined`

Defined in: [classes/StateMachine.ts:23](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/classes/StateMachine.ts#L23)

The context of the state machine, which can be used to store additional data that is relevant to the state machine's operation. The context is passed to the event handlers of the state machine, and can be used to maintain state across transitions.

## Accessors

### definition

#### Get Signature

> **get** **definition**(): [`Definition`](../type-aliases/Definition.md)\<`S`, `E`, `Context`\>

Defined in: [classes/StateMachine.ts:146](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/classes/StateMachine.ts#L146)

The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.

##### Returns

[`Definition`](../type-aliases/Definition.md)\<`S`, `E`, `Context`\>

***

### state

#### Get Signature

> **get** **state**(): `S`

Defined in: [classes/StateMachine.ts:139](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/classes/StateMachine.ts#L139)

The current state of the state machine.

##### Returns

`S`

## Methods

### clone()

> **clone**(): `StateMachine`\<`S`, `E`, `Context`\>

Defined in: [classes/StateMachine.ts:154](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/classes/StateMachine.ts#L154)

Creates a new instance of the `StateMachine` class with the same definition, state, and context as the current instance.

#### Returns

`StateMachine`\<`S`, `E`, `Context`\>

A new `StateMachine` instance that is a clone of the current instance.

***

### send()

> **send**(`event`): `void`

Defined in: [classes/StateMachine.ts:58](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/classes/StateMachine.ts#L58)

#### Parameters

##### event

`E`

#### Returns

`void`
