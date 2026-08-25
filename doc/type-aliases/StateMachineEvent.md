[**statry**](../README.md)

***

[statry](../README.md) / StateMachineEvent

# Type Alias: StateMachineEvent\<M\>

> **StateMachineEvent**\<`M`\> = `{ [S in keyof M & string]: { [E in keyof M[S] & string]: [EventOfTransition<M, S, E>] extends [never] ? { type: E } : EventOfTransition<M, S, E> }[keyof M[S] & string] }`\[keyof `M` & `string`\]

Defined in: [types/StateMachineEvent.ts:18](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/types/StateMachineEvent.ts#L18)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
