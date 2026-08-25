[**statry**](../README.md)

***

[statry](../README.md) / CleanupCallback

# Type Alias: CleanupCallback\<S, E, Context\>

> **CleanupCallback**\<`S`, `E`, `Context`\> = (`event`, `state`, `context`) => `void`

Defined in: [types/CleanupCallback.ts:6](https://github.com/nevoland/statry/blob/26fbc7e280c5d9550693cfbd8d7e0c5c0a5b976e/lib/types/CleanupCallback.ts#L6)

## Type Parameters

### S

`S` *extends* [`State`](State.md)

### E

`E` *extends* [`Event`](Event.md)

### Context

`Context`

## Parameters

### event

[`RuntimeEvent`](RuntimeEvent.md)\<[`StateMachineDefinition`](StateMachineDefinition.md)\<`S`, `E`, `Context`\>\>

### state

`S`

### context

`Context`

## Returns

`void`
