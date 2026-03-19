type AuthEvent = 'SESSION_EXPIRED' | 'LOGOUT';
type Listener = () => void;

const sessionListeners: Set<Listener> = new Set();
const logoutListeners: Set<Listener> = new Set();

export const authEventEmitter = {
  on(event: AuthEvent, callback: Listener): () => void {
    if (event === 'SESSION_EXPIRED') {
      sessionListeners.add(callback);
      return () => sessionListeners.delete(callback);
    }
    if (event === 'LOGOUT') {
      logoutListeners.add(callback);
      return () => logoutListeners.delete(callback);
    }
    return () => {};
  },
  emit(event: AuthEvent): void {
    if (event === 'SESSION_EXPIRED') sessionListeners.forEach((cb) => cb());
    if (event === 'LOGOUT') logoutListeners.forEach((cb) => cb());
  },
};
