[**statry**](../README.md)

***

[statry](../README.md) / CleanupCallback

# Type Alias: CleanupCallback\<S, E, Context\>

> **CleanupCallback**\<`S`, `E`, `Context`\> = (`event`, `state`, `context`) => `void`

Defined in: [types/CleanupCallback.ts:6](https://github.com/nevoland/statry/blob/3e77b23b999708af70ec7e60550ca5076ef79b03/lib/types/CleanupCallback.ts#L6)

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
