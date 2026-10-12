/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPickerHiddenTags(
  runtime: RuntimeBindings,
): () => void {
  var PickerHiddenTagsPattern: Dynamic;
  var PickerHiddenTagsSubscribers: Dynamic;
  var PickerHiddenTagsSubscribers_2: Dynamic;
  var PickerHiddenTagsItems: Dynamic;
  function notifyHiddenPickerTags(): Dynamic {
    PickerHiddenTagsItems = [...PickerHiddenTagsSubscribers];
    for (let value of PickerHiddenTagsSubscribers_2 as Dynamic) value();
  }
  function registerHiddenPickerTag(input?: Dynamic): Dynamic {
    return !PickerHiddenTagsPattern.test(input) ||
      PickerHiddenTagsSubscribers.has(input)
      ? (): Dynamic => {}
      : (PickerHiddenTagsSubscribers.add(input),
        notifyHiddenPickerTags(),
        (): Dynamic => {
          PickerHiddenTagsSubscribers.delete(input) && notifyHiddenPickerTags();
        });
  }
  function getHiddenPickerTags(): Dynamic {
    return PickerHiddenTagsItems;
  }
  function subscribeHiddenPickerTags(input?: Dynamic): Dynamic {
    PickerHiddenTagsSubscribers_2.add(input);
    return (): Dynamic => {
      PickerHiddenTagsSubscribers_2.delete(input);
    };
  }
  bindRuntimeValue(
    runtime,
    "PickerHiddenTagsPattern",
    () => PickerHiddenTagsPattern,
    (value) => {
      PickerHiddenTagsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerHiddenTagsSubscribers",
    () => PickerHiddenTagsSubscribers,
    (value) => {
      PickerHiddenTagsSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerHiddenTagsSubscribers_2",
    () => PickerHiddenTagsSubscribers_2,
    (value) => {
      PickerHiddenTagsSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerHiddenTagsItems",
    () => PickerHiddenTagsItems,
    (value) => {
      PickerHiddenTagsItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyHiddenPickerTags",
    () => notifyHiddenPickerTags,
  );
  bindRuntimeValue(
    runtime,
    "registerHiddenPickerTag",
    () => registerHiddenPickerTag,
  );
  bindRuntimeValue(runtime, "getHiddenPickerTags", () => getHiddenPickerTags);
  bindRuntimeValue(
    runtime,
    "subscribeHiddenPickerTags",
    () => subscribeHiddenPickerTags,
  );
  return () => {
    PickerHiddenTagsPattern = /^[a-z0-9-]{1,48}$/;
    PickerHiddenTagsSubscribers = new Set();
    PickerHiddenTagsSubscribers_2 = new Set();
    PickerHiddenTagsItems = [];
  };
}
