[**statry**](../README.md)

***

[statry](../README.md) / StateMachineState

# Type Alias: StateMachineState\<M\>

> **StateMachineState**\<`M`\> = `Extract`\<`{ [StateType in keyof M & string]: StateMachineStateFromNode<M[StateType], StateType> }`\[keyof `M` & `string`\], \{ `type`: `string`; \}\>

Defined in: [types/StateMachineState.ts:13](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/types/StateMachineState.ts#L13)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
