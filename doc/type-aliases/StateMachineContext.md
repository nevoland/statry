[**statry**](../README.md)

***

[statry](../README.md) / StateMachineContext

# Type Alias: StateMachineContext\<M\>

> **StateMachineContext**\<`M`\> = `{ [StateType in keyof M & string]: ContextFromNode<M[StateType]> }`\[keyof `M` & `string`\]

Defined in: [types/StateMachineContext.ts:24](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/types/StateMachineContext.ts#L24)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
