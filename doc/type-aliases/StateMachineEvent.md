[**statry**](../README.md)

***

[statry](../README.md) / StateMachineEvent

# Type Alias: StateMachineEvent\<M\>

> **StateMachineEvent**\<`M`\> = `{ [S in keyof M & string]: { [E in keyof M[S] & string]: [EventOfTransition<M, S, E>] extends [never] ? { type: E } : EventOfTransition<M, S, E> }[keyof M[S] & string] }`\[keyof `M` & `string`\]

Defined in: [types/StateMachineEvent.ts:18](https://github.com/nevoland/statry/blob/3e77b23b999708af70ec7e60550ca5076ef79b03/lib/types/StateMachineEvent.ts#L18)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
