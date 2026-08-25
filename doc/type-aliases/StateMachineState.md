[**statra**](../README.md)

***

[statra](../README.md) / StateMachineState

# Type Alias: StateMachineState\<M\>

> **StateMachineState**\<`M`\> = `Extract`\<`{ [StateType in keyof M & string]: StateMachineStateFromNode<M[StateType], StateType> }`\[keyof `M` & `string`\], \{ `type`: `string`; \}\>

Defined in: [types/StateMachineState.ts:13](https://github.com/nevoland/statra/blob/3e77b23b999708af70ec7e60550ca5076ef79b03/lib/types/StateMachineState.ts#L13)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
