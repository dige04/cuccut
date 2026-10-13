import { createContext, useContext, type ReactNode } from "react";
import {
  ActionButton,
  ToggleButton,
  ToggleButtonGroup,
} from "@react-spectrum/s2";
import ChevronLeft from "@react-spectrum/s2/icons/ChevronLeft";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

const head = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
  boxSizing: "border-box",
  height: 44,
  paddingStart: 16,
  paddingEnd: 8,
});
const title = style({
  flexGrow: 1,
  minWidth: 0,
  margin: 0,
  font: "title-sm",
  fontWeight: "medium",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

/** 页头下面滚动的那一块。 */
export const panelBody = style({
  flexGrow: 1,
  minHeight: 0,
  overflowY: "auto",
  paddingX: 16,
  paddingTop: 8,
  paddingBottom: 16,
});

/**
 * Set by the editor's panel card, whose chip row already names the panel: a top-level page's title then only reaches
 * screen readers (a page with a back button keeps it, since it names a deeper page the chips do not).
 */
export const PanelTitleNamed = createContext(false);

/** A panel page's head inside its card: 44 high, (back,) the title and the actions on the right; no rule under it (agentcut cards). */
export function PanelHead({
  title: text,
  back,
  children,
}: {
  title: string;
  /** 页头左边的返回钮：`label` 是它的说明。 */
  back?: { label: string; onPress(): void };
  children?: ReactNode;
}) {
  const named = useContext(PanelTitleNamed) && !back;
  if (named && !children) return <h2 className="sr-only">{text}</h2>;
  if (named) {
    return (
      <div className={head}>
        <h2 className="sr-only">{text}</h2>
        <span className={title} />
        {children}
      </div>
    );
  }
  return (
    <div className={head}>
      {back ? (
        <ActionButton
          isQuiet
          size="S"
          aria-label={back.label}
          onPress={back.onPress}
        >
          <ChevronLeft />
        </ActionButton>
      ) : null}
      <h2 className={title} title={text}>
        {text}
      </h2>
      {children}
    </div>
  );
}

const chipRow = style({
  flexShrink: 0,
  paddingX: 16,
  paddingTop: 4,
  paddingBottom: 4,
});

/** 页头下面那一行分类（原型 .chiprow）：单选，选中的那一格总有一格。 */
export function PanelChips<K extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly { key: K; label: string }[];
  value: K;
  onChange(key: K): void;
}) {
  return (
    <div className={chipRow}>
      <ToggleButtonGroup
        aria-label={label}
        size="S"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const key = [...keys][0];
          if (key !== undefined) onChange(key as K);
        }}
      >
        {items.map((item) => (
          <ToggleButton key={item.key} id={item.key}>
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
