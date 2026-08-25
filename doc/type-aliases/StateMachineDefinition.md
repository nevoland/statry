[**statra**](../README.md)

***

[statra](../README.md) / StateMachineDefinition

# Type Alias: StateMachineDefinition\<S, E, Context\>

> **StateMachineDefinition**\<`S`, `E`, `Context`\> = \{ \[SType in S\["type"\]\]: \{ \[ENTER\]?: (event: RuntimeEventStateTransition\<Extract\<S, \{ type: SType \}\>, StateMachineTarget\<E\>, E, S\>, state: Extract\<S, \{ type: SType \}\>, context: Context, send: (event: E) =\> void) =\> CleanupCallback\<S, E, Context\> \| void \} & \{ \[EType in E\["type"\]\]?: (event: Extract\<E, \{ type: EType \}\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> S \} \}

Defined in: [types/StateMachineDefinition.ts:19](https://github.com/nevoland/statra/blob/3e77b23b999708af70ec7e60550ca5076ef79b03/lib/types/StateMachineDefinition.ts#L19)

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
