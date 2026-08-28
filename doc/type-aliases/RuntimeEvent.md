[**statry**](../README.md)

***

[statry](../README.md) / RuntimeEvent

# Type Alias: RuntimeEvent\<M\>

> **RuntimeEvent**\<`M`\> = `RuntimeEventInternal`\<`StateMachineState`\<`M`\>, `StateMachineEvent`\<`M`\>, `StateMachineContext`\<`M`\>\>

Defined in: [types/RuntimeEvent.ts:48](https://github.com/nevoland/statry/blob/f7836227d0d17e86fb52b62918107c9df8ef0af2/lib/types/RuntimeEvent.ts#L48)

Runtime event emitted by a `StateMachine`, with state, event, and context types inferred from `M`.

## Type Parameters

### M

`M` *extends* [`StateMachine`](../classes/StateMachine.md)\<`any`, `any`, `any`\>

The `StateMachine` instance type to infer state, event, and context types from.
