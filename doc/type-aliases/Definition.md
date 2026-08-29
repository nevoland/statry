[**statry**](../README.md)

***

[statry](../README.md) / Definition

# Type Alias: Definition\<S, E, Context\>

> **Definition**\<`S`, `E`, `Context`\> = \{ \[SType in S\["type"\]\]: \{ \[ENTER\]?: (event: RuntimeEventInternal\<Extract\<S, \{ type: SType \}\>, E, Context\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> CleanupCallback\<S, E, Context\> \| void \} & \{ \[EType in E\["type"\]\]?: (event: Extract\<E, \{ type: EType \}\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> S \} \}

Defined in: [types/Definition.ts:15](https://github.com/nevoland/statry/blob/b4e0df9240029629771df17658b9c3e98d04f4e0/lib/types/Definition.ts#L15)

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
