[**statry**](../README.md)

***

[statry](../README.md) / RuntimeEvent

# Type Alias: RuntimeEvent\<M\>

> **RuntimeEvent**\<`M`\> = `RuntimeEventInternal`\<`StateMachineState`\<`M`\>, `StateMachineEvent`\<`M`\>, `StateMachineContext`\<`M`\>\>

Defined in: [types/RuntimeEvent.ts:75](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/types/RuntimeEvent.ts#L75)

Runtime event emitted by a `StateMachine`, with state, event, and context types inferred from `M`.

## Type Parameters

### M

`M` *extends* [`StateMachine`](../classes/StateMachine.md)\<`any`, `any`, `any`\>

The `StateMachine` instance type to infer state, event, and context types from.
