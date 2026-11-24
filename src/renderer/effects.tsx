"use client";

import { createContext, type ComponentType, useContext } from "react";

/**
 * Optional text effects supplied by the (lazy) animation layer. In static mode the
 * context is empty and plain text is rendered, so this file costs almost nothing.
 */
export interface TextEffects {
  Headline?: ComponentType<{ text: string }>;
  Greeting?: ComponentType<{ text: string }>;
}

export const TextEffectsContext = createContext<TextEffects>({});

export function useTextEffects(): TextEffects {
  return useContext(TextEffectsContext);
}
