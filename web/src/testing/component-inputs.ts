import type { InputSignal, ModelSignal } from '@angular/core';

export type ComponentInputs<Component> = {
  [Key in keyof Component]?: Component[Key] extends InputSignal<infer Value>
    ? Value
    : Component[Key] extends ModelSignal<infer Value>
      ? Value
      : never;
};
