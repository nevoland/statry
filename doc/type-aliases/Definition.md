[**statry**](../README.md)

***

[statry](../README.md) / Definition

# Type Alias: Definition\<S, E, Context\>

> **Definition**\<`S`, `E`, `Context`\> = \{ \[SType in S\["type"\]\]: \{ \[ENTER\]?: (event: RuntimeEventInternal\<Extract\<S, \{ type: SType \}\>, E, Context\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> CleanupCallback\<S, E, Context\> \| void \} & \{ \[EType in E\["type"\]\]?: (event: Extract\<E, \{ type: EType \}\>, state: Extract\<S, \{ type: SType \}\>, context: Context) =\> S \} \}

Defined in: [types/Definition.ts:16](https://github.com/nevoland/statry/blob/54693dd9a671cdcc0c9210a15f1c77deb6299c1e/lib/types/Definition.ts#L16)

Definition of a state machine: for each state `type`, an optional `ENTER` lifecycle hook and a
map from event `type` to a transition handler.

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
