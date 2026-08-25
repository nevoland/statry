[**statry**](../README.md)

***

[statry](../README.md) / StateMachineState

# Type Alias: StateMachineState\<M\>

> **StateMachineState**\<`M`\> = `Extract`\<`{ [StateType in keyof M & string]: StateMachineStateFromNode<M[StateType], StateType> }`\[keyof `M` & `string`\], \{ `type`: `string`; \}\>

Defined in: [types/StateMachineState.ts:13](https://github.com/nevoland/statry/blob/26fbc7e280c5d9550693cfbd8d7e0c5c0a5b976e/lib/types/StateMachineState.ts#L13)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
