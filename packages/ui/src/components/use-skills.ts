import { useCallback, useEffect } from 'react';
import { useRuntime } from '../runtime/context.tsx';
import { loadSkills } from '../runtime/skill-commands.ts';
import { useConnection } from '../state/connection-store.ts';
import { useSkills, type SkillsStore } from '../state/skills-store.ts';

/**
 * The skill list: fetched once on mount and once on reconnect (shared by Settings › Skills and the input box; several requests at the same time send only one). Not sent while disconnected; it waits until connected.
 * Returns a mirror of the list and a “retry”.
 */
export function useSkillsLoader(): SkillsStore & { retry(): void } {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const skills = useSkills();
  useEffect(() => {
    if (connected) void loadSkills(runtime);
  }, [runtime, connected]);
  const retry = useCallback(() => void loadSkills(runtime), [runtime]);
  return { ...skills, retry };
}
