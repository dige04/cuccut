/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** The host's `profiles` reply: untrusted records keyed by user id. */
type UserProfilesReply = Record<string, { name?: unknown } | undefined>;
/** The host's `me` reply: untrusted display fields. */
interface CurrentUserReply {
  name?: unknown;
  color?: unknown;
}
/** Methods of the host's `user` capability the runtime calls; each is probed with `capabilityHasMethod` first and its reply is validated. */
export interface UserMethods {
  id(): Promise<unknown>;
  canEdit(): Promise<unknown>;
  can(capability: string): Promise<unknown>;
  profiles(userIds: readonly string[]): Promise<UserProfilesReply | null | undefined>;
  me(): Promise<CurrentUserReply | null | undefined>;
}
/** Names of the `user` methods that take no arguments. */
export type NoArgUserMethodName = "id" | "canEdit" | "me";
/** The current user's display identity. */
export interface CurrentUserProfile {
  name: string;
  color: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactx4: ReactNamespace;
    /** Loads the `user` capability and returns one of its methods bound to it, or undefined when the host lacks it. */
    resolveUserMethod: <K extends keyof UserMethods>(
      name: K,
    ) => Promise<UserMethods[K] | undefined>;
    /** Calls a no-argument `user` method and returns its reply when `validate` accepts it, else null (also on errors). */
    callValidatedUserMethod: <T>(
      name: NoArgUserMethodName,
      validate: (value: unknown) => value is T,
    ) => Promise<T | null>;
    isNonemptyUserString: (value: unknown) => value is string;
    /** The signed-in user's id, or null when unknown. */
    currentUserId: () => Promise<string | null>;
    /** Whether the user may edit; null when the host cannot tell. */
    currentUserCanEdit: () => Promise<boolean | null>;
    /** Whether the user has a named capability; null when the host cannot tell. */
    currentUserCan: (capability: string) => Promise<boolean | null>;
    /** Display names by user id; ids the host does not know are left out. */
    userProfiles: (userIds: readonly string[]) => Promise<Map<string, string>>;
    currentUserCanEditAsync: () => Promise<boolean | null>;
    currentUserProfile: () => Promise<CurrentUserProfile | null>;
  }
}

export function installHostUserApi(runtime: RuntimeBindings): () => void {
  var reactx4: ReactNamespace;
  var isNonemptyUserString: (value: unknown) => value is string;
  async function resolveUserMethod<K extends keyof UserMethods>(
    name: K,
  ): Promise<UserMethods[K] | undefined> {
    let value = await (0, runtime.getOrLoadHostCapability)<UserMethods>(
      "user",
      (0, runtime.capabilityHasMethod)<UserMethods>(name),
    );
    if (value === null) {
      return undefined;
    } else {
      return value[name].bind(value) as UserMethods[K];
    }
  }
  async function callValidatedUserMethod<T>(
    name: NoArgUserMethodName,
    validate: (value: unknown) => value is T,
  ): Promise<T | null> {
    let value = await resolveUserMethod(name);
    if (!value) {
      return null;
    }
    try {
      let value2 = await value();
      if (validate(value2)) {
        return value2;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function currentUserId(): Promise<string | null> {
    return callValidatedUserMethod("id", isNonemptyUserString);
  }
  async function currentUserCanEdit(): Promise<boolean | null> {
    let value = await resolveUserMethod("canEdit");
    if (!value) {
      return null;
    }
    try {
      let value2 = await value();
      if (value2 === true) {
        return true;
      } else {
        if (value2 === false) {
          return false;
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }
  }
  async function currentUserCan(capability: string): Promise<boolean | null> {
    let value = await resolveUserMethod("can");
    if (!value) {
      return null;
    }
    try {
      let value2 = await value(capability);
      if (typeof value2 === "boolean") {
        return value2;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  async function userProfiles(
    userIds: readonly string[],
  ): Promise<Map<string, string>> {
    let entries = new Map<string, string>(),
      value =
        userIds.length > 0 ? await resolveUserMethod("profiles") : undefined;
    if (!value) {
      return entries;
    }
    try {
      let value2 = await value(userIds);
      if (typeof value2 !== "object" || value2 === null) {
        return entries;
      }
      for (let value3 of userIds) {
        let value4 = Object.hasOwn(value2, value3)
          ? value2[value3]?.name
          : undefined;
        if (isNonemptyUserString(value4)) {
          entries.set(value3, value4);
        }
      }
    } catch {}
    return entries;
  }
  async function currentUserCanEditAsync(): Promise<boolean | null> {
    let value = await (0, runtime.loadHostCapabilityWithTimeout)<UserMethods>(
      "user",
      (0, runtime.capabilityHasMethod)<UserMethods>("canEdit"),
    );
    if (value === null) {
      return null;
    }
    try {
      let value2 = await value.canEdit.call(value);
      if (value2 === true) {
        return true;
      } else {
        if (value2 === false) {
          return false;
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }
  }
  async function currentUserProfile(): Promise<CurrentUserProfile | null> {
    let value = await (0, runtime.getOrLoadHostCapability)<UserMethods>(
      "user",
      (0, runtime.capabilityHasMethod)<UserMethods>("me"),
    );
    if (value === null) {
      return null;
    }
    try {
      let value2 = await value.me.call(value);
      if (typeof value2 !== "object" || value2 === null) {
        return null;
      }
      return {
        name: typeof value2.name === "string" ? value2.name : "",
        color: typeof value2.color === "string" ? value2.color : "",
      };
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "reactx4",
    () => reactx4,
    (value) => {
      reactx4 = value;
    },
  );
  bindRuntimeValue(runtime, "resolveUserMethod", () => resolveUserMethod);
  bindRuntimeValue(
    runtime,
    "callValidatedUserMethod",
    () => callValidatedUserMethod,
  );
  bindRuntimeValue(
    runtime,
    "isNonemptyUserString",
    () => isNonemptyUserString,
    (value) => {
      isNonemptyUserString = value;
    },
  );
  bindRuntimeValue(runtime, "currentUserId", () => currentUserId);
  bindRuntimeValue(runtime, "currentUserCanEdit", () => currentUserCanEdit);
  bindRuntimeValue(runtime, "currentUserCan", () => currentUserCan);
  bindRuntimeValue(runtime, "userProfiles", () => userProfiles);
  bindRuntimeValue(
    runtime,
    "currentUserCanEditAsync",
    () => currentUserCanEditAsync,
  );
  bindRuntimeValue(runtime, "currentUserProfile", () => currentUserProfile);
  return () => {
    (0, runtime.initializeUiInputs210)();
    reactx4 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    isNonemptyUserString = (value: unknown): value is string =>
      typeof value === "string" && value.length > 0;
  };
}
