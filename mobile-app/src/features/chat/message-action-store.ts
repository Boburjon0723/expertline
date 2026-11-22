import type { Message } from "./types";

type Listener = () => void;
const listeners = new Set<Listener>();
let current: Message | null = null;

export function getActionMessage() {
  return current;
}

export function setActionMessage(message: Message | null) {
  current = message;
  listeners.forEach((fn) => fn());
}

export function subscribeActionMessage(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
