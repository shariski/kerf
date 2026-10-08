import { create } from "zustand";

/** Visual nav state only. Coding events and metrics remain outside the Keyboard session store. */
export const useCodeSessionActivity = create<{
  active: boolean;
  setActive: (active: boolean) => void;
}>((set) => ({ active: false, setActive: (active) => set({ active }) }));
