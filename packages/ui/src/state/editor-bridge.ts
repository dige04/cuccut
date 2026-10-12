import { create } from 'zustand';

/**
 * 编辑器标签（幻灯片、设计稿、设计系统）之外的地方对打开着的编辑器的两个要求（docs/design/slides §8.2、docs/design/canvas §8.2），
 * 按标签的 `itemKey`（`slides:<targetKey>`、`design:<targetKey>`、`design-system:<targetKey>`）找到它：
 *
 * - **发送前保存**：编辑器里改了字还没发布完时，先让它发布完再发消息，智能体读到的是用户看到的版本。
 *   标签页在编辑器载入后登记，卸下时注销；没打开这份文档的不用等。
 * - **跳到标注所在的位置**：已发送消息里的标注点一条，先打开（或切到）这份文档的标签，
 *   标签页在编辑器载入后取走这个要求再跳。
 */

/** 一个打开着的编辑器：`flush` 让它发布完，返回保存成了没有；`name` 是这份文档当前的名字，没保存成时提示里写出来。 */
interface Flusher {
  flush(): Promise<boolean>;
  name(): string;
}
const flushers = new Map<string, Set<Flusher>>();

/** 标签页登记它的编辑器；返回注销函数。 */
export function registerEditorFlush(key: string, flusher: Flusher): () => void {
  let set = flushers.get(key);
  if (!set) flushers.set(key, (set = new Set()));
  set.add(flusher);
  return () => {
    set.delete(flusher);
    if (!set.size) flushers.delete(key);
  };
}

/**
 * 让这几份文档打开着的编辑器都把改动发布完；返回没保存成的那几份的名字（同名的只算一次），都保存好了时为空。
 * 不拦发送，由调用方决定。
 */
export async function flushEditors(keys: Iterable<string>): Promise<string[]> {
  const pending = [...new Set(keys)].flatMap((key) =>
    [...(flushers.get(key) ?? [])].map(async (flusher) => ((await flusher.flush().catch(() => false)) ? null : flusher.name())),
  );
  const failed = (await Promise.all(pending)).filter((name): name is string => name !== null);
  return [...new Set(failed)];
}

/**
 * 等着跳过去的一处：`id` 是编辑器里这条标注的 id，`anchor` 是它的锚点，`section` 是设计系统里它所在的章节（先到那一章）。
 * `seq` 让同一处再点一次也算新的要求。
 */
export interface EditorReveal {
  id: string;
  anchor: string;
  section?: string;
  seq: number;
}

interface EditorRevealStore {
  reveals: Record<string, EditorReveal>;
  request(key: string, id: string, anchor: string, section?: string): void;
  /** 标签页取走（取走后清掉）。 */
  take(key: string, seq: number): void;
}

let seq = 0;

export const useEditorReveal = create<EditorRevealStore>()((set) => ({
  reveals: {},
  request: (key, id, anchor, section) =>
    set((s) => ({ reveals: { ...s.reveals, [key]: { id, anchor, ...(section ? { section } : {}), seq: ++seq } } })),
  take: (key, taken) =>
    set((s) => {
      if (s.reveals[key]?.seq !== taken) return {};
      const { [key]: _done, ...reveals } = s.reveals;
      return { reveals };
    }),
}));
