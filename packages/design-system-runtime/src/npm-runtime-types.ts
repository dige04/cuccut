/** Exact imported npm surfaces; library implementation types stay with npm. */
export interface NpmRuntimeBindings {
loadReactNamespace: () => typeof import("react");
loadReactDomNamespace: () => typeof import("react-dom");
loadReactDomClientNamespace: () => typeof import("react-dom/client");
loadJsxNamespace: () => typeof import("react/jsx-runtime");
baseMenu: typeof import("@base-ui/react/menu").Menu;
baseContextMenu: typeof import("@base-ui/react/context-menu").ContextMenu;
basePopover: typeof import("@base-ui/react/popover").Popover;
baseCombobox: typeof import("@base-ui/react/combobox").Combobox;
baseTooltip: typeof import("@base-ui/react/tooltip").Tooltip;
baseCollapsible: typeof import("@base-ui/react/collapsible").Collapsible;
baseField: typeof import("@base-ui/react/field").Field;
baseDialog: typeof import("@base-ui/react/dialog").Dialog;
baseAlertDialog: typeof import("@base-ui/react/alert-dialog").AlertDialog;
baseRadio: typeof import("@base-ui/react/radio").Radio;
baseCheckbox: typeof import("@base-ui/react/checkbox").Checkbox;
baseTabs: typeof import("@base-ui/react/tabs").Tabs;
baseToast: typeof import("@base-ui/react/toast").Toast;
baseRadioGroup: typeof import("@base-ui/react/radio-group").RadioGroup;
baseButton: typeof import("@base-ui/react/button").Button;
baseUseRender: typeof import("@base-ui/react/use-render").useRender;
baseMergeProps: typeof import("@base-ui/react/merge-props").mergeProps;
baseLabelableProvider: typeof import("@base-ui/react/internals/labelable-provider").LabelableProvider;
baseSwitch: typeof import("@base-ui/react/switch").Switch;
baseNumberField: typeof import("@base-ui/react/number-field").NumberField;
baseUseLabelableContext: typeof import("@base-ui/react/internals/labelable-provider").useLabelableContext;
baseMenubarRoot: typeof import("@base-ui/react/menubar").Menubar;
clsx: typeof import("clsx").clsx;
extendTailwindMerge: typeof import("tailwind-merge").extendTailwindMerge;
validators: typeof import("tailwind-merge").validators;
cva: typeof import("class-variance-authority").cva;
useVirtualizer: typeof import("@tanstack/react-virtual").useVirtualizer;
measureVirtualElement: typeof import("@tanstack/virtual-core").measureElement;
initializeNpmDependency: () => void;
}
