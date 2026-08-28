[**statry**](../README.md)

***

[statry](../README.md) / RuntimeEvent

# Type Alias: RuntimeEvent\<M\>

> **RuntimeEvent**\<`M`\> = `RuntimeEventInternal`\<`StateMachineState`\<`M`\>, `StateMachineEvent`\<`M`\>, `StateMachineContext`\<`M`\>\>

Defined in: [types/RuntimeEvent.ts:48](https://github.com/nevoland/statry/blob/4ba956a46ccac90804d0f79f0d0b4167c81733a6/lib/types/RuntimeEvent.ts#L48)

Runtime event emitted by a `StateMachine`, with state, event, and context types inferred from `M`.

## Type Parameters

### M

`M` *extends* [`StateMachine`](../classes/StateMachine.md)\<`any`, `any`, `any`\>

The `StateMachine` instance type to infer state, event, and context types from.
