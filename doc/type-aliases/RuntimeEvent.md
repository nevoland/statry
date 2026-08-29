[**statry**](../README.md)

***

[statry](../README.md) / RuntimeEvent

# Type Alias: RuntimeEvent\<M\>

> **RuntimeEvent**\<`M`\> = `RuntimeEventInternal`\<`StateMachineState`\<`M`\>, `StateMachineEvent`\<`M`\>, `StateMachineContext`\<`M`\>\>

Defined in: [types/RuntimeEvent.ts:65](https://github.com/nevoland/statry/blob/b4e0df9240029629771df17658b9c3e98d04f4e0/lib/types/RuntimeEvent.ts#L65)

Runtime event emitted by a `StateMachine`, with state, event, and context types inferred from `M`.

## Type Parameters

### M

`M` *extends* [`StateMachine`](../classes/StateMachine.md)\<`any`, `any`, `any`\>

The `StateMachine` instance type to infer state, event, and context types from.
