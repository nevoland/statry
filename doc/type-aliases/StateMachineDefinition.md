[**statry**](../README.md)

***

[statry](../README.md) / StateMachineDefinition

# Type Alias: StateMachineDefinition\<S, E, Context\>

> **StateMachineDefinition**\<`S`, `E`, `Context`\> = \{ \[SType in S\["type"\]\]: \{ \[ENTER\]?: (event: RuntimeEventStateTransition\<Extract\<S, \{ type: SType \}\>, StateMachineTarget\<E\>, E, S\>, state: Extract\<S, \{ type: SType \}\>, context: Context, send: (event: E) =\> void) =\> CleanupCallback\<S, E, Context\> \| void \} & \{ \[EType in E\["type"\]\]?: (event: Extract\<E, \{ type: EType \}\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> S \} \}

Defined in: [types/StateMachineDefinition.ts:19](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/types/StateMachineDefinition.ts#L19)

Mapping of state transitions to their corresponding events.

## Type Parameters

### S

`S` *extends* [`State`](State.md)

The state type.

### E

`E` *extends* [`Event`](Event.md)

The event type.

### Context

`Context`

The context type.
