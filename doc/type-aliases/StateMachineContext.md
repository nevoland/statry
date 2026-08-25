[**statry**](../README.md)

***

[statry](../README.md) / StateMachineContext

# Type Alias: StateMachineContext\<M\>

> **StateMachineContext**\<`M`\> = `{ [StateType in keyof M & string]: ContextFromNode<M[StateType]> }`\[keyof `M` & `string`\]

Defined in: [types/StateMachineContext.ts:24](https://github.com/nevoland/statry/blob/26fbc7e280c5d9550693cfbd8d7e0c5c0a5b976e/lib/types/StateMachineContext.ts#L24)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
