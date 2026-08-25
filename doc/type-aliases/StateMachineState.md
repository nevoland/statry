[**statry**](../README.md)

***

[statry](../README.md) / StateMachineState

# Type Alias: StateMachineState\<M\>

> **StateMachineState**\<`M`\> = `Extract`\<`{ [StateType in keyof M & string]: StateMachineStateFromNode<M[StateType], StateType> }`\[keyof `M` & `string`\], \{ `type`: `string`; \}\>

Defined in: [types/StateMachineState.ts:13](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/types/StateMachineState.ts#L13)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
