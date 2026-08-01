export type RuntimeEventStateTransition<S, MR, E, SPrevious> = {
  type: "statetransition";
  state: S;
  target: MR;
  trigger: E;
  timeStamp: number;
  previousState: SPrevious;
};
