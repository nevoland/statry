[**statry**](../README.md)

***

[statry](../README.md) / RuntimeEvent

# Type Alias: RuntimeEvent\<M\>

> **RuntimeEvent**\<`M`\> = \{ `previousState`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `state`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `target`: `StateMachineTarget`\<`M`\>; `timeStamp`: `number`; `trigger`: [`StateMachineEvent`](StateMachineEvent.md)\<`M`\>; `type`: `"statetransition"`; \} \| \{ `previousState`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `state`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `target`: `StateMachineTarget`\<`M`\>; `timeStamp`: `number`; `trigger`: [`StateMachineEvent`](StateMachineEvent.md)\<`M`\>; `type`: `"selftransition"`; \} \| \{ `state`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `target`: `StateMachineTarget`\<`M`\>; `timeStamp`: `number`; `trigger`: [`StateMachineEvent`](StateMachineEvent.md)\<`M`\>; `type`: `"ignoredevent"`; \}

Defined in: [types/RuntimeEvent.ts:10](https://github.com/nevoland/statry/blob/759112c9274556ca461526f9b5d90ca3ca2168d5/lib/types/RuntimeEvent.ts#L10)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
