import { TupleNode } from "../core/providers/tuple.js";
import { synthesizedModuleKey } from "../core/shared/constants.js";
import { Synthesized } from "../core/synthesize.js";
import type { Narrow } from "../types.js";

export const tuple = <T extends readonly Synthesized[]>(spec: Narrow<T>) =>
    new Synthesized(new TupleNode(spec.map((e) => Reflect.get(e, Symbol.for(synthesizedModuleKey)))));
