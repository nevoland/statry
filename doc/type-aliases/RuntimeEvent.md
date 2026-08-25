[**statry**](../README.md)

***

[statry](../README.md) / RuntimeEvent

# Type Alias: RuntimeEvent\<M\>

> **RuntimeEvent**\<`M`\> = \{ `previousState`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `state`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `target`: `StateMachineTarget`\<`M`\>; `timeStamp`: `number`; `trigger`: [`StateMachineEvent`](StateMachineEvent.md)\<`M`\>; `type`: `"statetransition"`; \} \| \{ `previousState`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `state`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `target`: `StateMachineTarget`\<`M`\>; `timeStamp`: `number`; `trigger`: [`StateMachineEvent`](StateMachineEvent.md)\<`M`\>; `type`: `"selftransition"`; \} \| \{ `state`: [`StateMachineState`](StateMachineState.md)\<`M`\>; `target`: `StateMachineTarget`\<`M`\>; `timeStamp`: `number`; `trigger`: [`StateMachineEvent`](StateMachineEvent.md)\<`M`\>; `type`: `"ignoredevent"`; \}

Defined in: [types/RuntimeEvent.ts:10](https://github.com/nevoland/statry/blob/3e77b23b999708af70ec7e60550ca5076ef79b03/lib/types/RuntimeEvent.ts#L10)

## Type Parameters

### M

`M` *extends* `StateMachineLike`
