[**statry**](../README.md)

***

[statry](../README.md) / StateMachine

# Class: StateMachine\<S, E, Context\>

Defined in: [classes/StateMachine.ts:15](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L15)

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

Defined in: [classes/StateMachine.ts:53](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L53)

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

Defined in: [classes/StateMachine.ts:23](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L23)

The context of the state machine, which can be used to store additional data that is relevant to the state machine's operation. The context is passed to the event handlers of the state machine, and can be used to maintain state across transitions.

***

### dispose

> **dispose**: () => `void`

Defined in: [classes/StateMachine.ts:195](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L195)

Disposes the state machine: emits a final `dispose` runtime event, invokes the pending cleanup callback (if any) returned by the most recent `ENTER` hook, and marks the machine as disposed. Bound to the instance so it can be passed as a callback.

After this call, `send()` becomes a silent no-op and no further runtime events are emitted.
Idempotent: calling `dispose()` on an already-disposed machine returns immediately without
re-dispatching the event or re-running the cleanup.

#### Returns

`void`

***

### send

> **send**: (`event`) => `void`

Defined in: [classes/StateMachine.ts:73](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L73)

Sends an event to the state machine, triggering any matching transition defined for the
current state. Bound to the instance so it can be passed as a callback.

#### Parameters

##### event

`E`

The event to dispatch.

#### Returns

`void`

## Accessors

### definition

#### Get Signature

> **get** **definition**(): [`Definition`](../type-aliases/Definition.md)\<`S`, `E`, `Context`\>

Defined in: [classes/StateMachine.ts:167](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L167)

The definition of the state machine, which includes the states, events, and transitions that define the behavior of the state machine.

##### Returns

[`Definition`](../type-aliases/Definition.md)\<`S`, `E`, `Context`\>

***

### disposed

#### Get Signature

> **get** **disposed**(): `boolean`

Defined in: [classes/StateMachine.ts:176](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L176)

Whether the state machine has been disposed. Once `true`, `send()` becomes a silent no-op and
subsequent calls to `dispose()` are ignored. No further runtime events are emitted after the
final `dispose` event.

##### Returns

`boolean`

***

### state

#### Get Signature

> **get** **state**(): `S`

Defined in: [classes/StateMachine.ts:160](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L160)

The current state of the state machine.

##### Returns

`S`

## Methods

### clone()

> **clone**(): `StateMachine`\<`S`, `E`, `Context`\>

Defined in: [classes/StateMachine.ts:184](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/classes/StateMachine.ts#L184)

Creates a new instance of the `StateMachine` class with the same definition, state, and context as the current instance.

#### Returns

`StateMachine`\<`S`, `E`, `Context`\>

A new `StateMachine` instance that is a clone of the current instance.
