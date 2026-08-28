[**statry**](../README.md)

***

[statry](../README.md) / Definition

# Type Alias: Definition\<S, E, Context\>

> **Definition**\<`S`, `E`, `Context`\> = \{ \[SType in S\["type"\]\]: \{ \[ENTER\]?: (event: RuntimeEventInternal\<Extract\<S, \{ type: SType \}\>, E, Context\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> CleanupCallback\<S, E, Context\> \| void \} & \{ \[EType in E\["type"\]\]?: (event: Extract\<E, \{ type: EType \}\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> S \} \}

Defined in: [types/Definition.ts:15](https://github.com/nevoland/statry/blob/f7836227d0d17e86fb52b62918107c9df8ef0af2/lib/types/Definition.ts#L15)

Mapping of state transitions to their corresponding events.

## Type Parameters

### S

`S` *extends* [`State`](State.md)

The state type.

### E

`E` *extends* [`Event`](Event.md)

The event type.

### Context

`Context` = `unknown`

The context type.
