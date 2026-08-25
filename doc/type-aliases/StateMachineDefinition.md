[**statry**](../README.md)

***

[statry](../README.md) / StateMachineDefinition

# Type Alias: StateMachineDefinition\<S, E, Context\>

> **StateMachineDefinition**\<`S`, `E`, `Context`\> = \{ \[SType in S\["type"\]\]: \{ \[ENTER\]?: (event: RuntimeEventStateTransition\<Extract\<S, \{ type: SType \}\>, StateMachineTarget\<E\>, E, S\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> CleanupCallback\<S, E, Context\> \| void \} & \{ \[EType in E\["type"\]\]?: (event: Extract\<E, \{ type: EType \}\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> S \} \}

Defined in: [types/StateMachineDefinition.ts:19](https://github.com/nevoland/statry/blob/26fbc7e280c5d9550693cfbd8d7e0c5c0a5b976e/lib/types/StateMachineDefinition.ts#L19)

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
