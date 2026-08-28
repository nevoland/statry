[**statry**](../README.md)

***

[statry](../README.md) / CleanupCallback

# Type Alias: CleanupCallback\<S, E, Context\>

> **CleanupCallback**\<`S`, `E`, `Context`\> = (`event`, `state`, `context?`) => `void`

Defined in: [types/CleanupCallback.ts:13](https://github.com/nevoland/statry/blob/f7836227d0d17e86fb52b62918107c9df8ef0af2/lib/types/CleanupCallback.ts#L13)

Callback invoked when leaving a state, receiving the triggering runtime event, the state being
exited, and the current context.

## Type Parameters

### S

`S` *extends* [`State`](State.md)

The state type.

### E

`E` *extends* [`Event`](Event.md)

The event type.

### Context

`Context`

The state machine's context type.

## Parameters

### event

`RuntimeEventInternal`\<`S`, `E`, `Context`\>

### state

`S`

### context?

`Context`

## Returns

`void`
