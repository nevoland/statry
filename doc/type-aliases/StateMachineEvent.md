[**statry**](../README.md)

***

[statry](../README.md) / StateMachineEvent

# Type Alias: StateMachineEvent\<M\>

> **StateMachineEvent**\<`M`\> = `{ [S in keyof M & string]: { [E in keyof M[S] & string]: [EventOfTransition<M, S, E>] extends [never] ? { type: E } : EventOfTransition<M, S, E> }[keyof M[S] & string] }`\[keyof `M` & `string`\]

Defined in: [types/StateMachineEvent.ts:18](https://github.com/nevoland/statry/blob/26fbc7e280c5d9550693cfbd8d7e0c5c0a5b976e/lib/types/StateMachineEvent.ts#L18)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
