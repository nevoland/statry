[**statry**](../README.md)

***

[statry](../README.md) / StateMachineContext

# Type Alias: StateMachineContext\<M\>

> **StateMachineContext**\<`M`\> = `{ [StateType in keyof M & string]: ContextFromNode<M[StateType]> }`\[keyof `M` & `string`\]

Defined in: [types/StateMachineContext.ts:24](https://github.com/nevoland/statry/blob/3e77b23b999708af70ec7e60550ca5076ef79b03/lib/types/StateMachineContext.ts#L24)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
