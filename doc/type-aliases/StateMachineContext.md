[**statry**](../README.md)

***

[statry](../README.md) / StateMachineContext

# Type Alias: StateMachineContext\<M\>

> **StateMachineContext**\<`M`\> = `{ [StateType in keyof M & string]: ContextFromNode<M[StateType]> }`\[keyof `M` & `string`\]

Defined in: [types/StateMachineContext.ts:24](https://github.com/nevoland/statry/blob/80189247c33ace13d4602eef9be60be7d4209b35/lib/types/StateMachineContext.ts#L24)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
