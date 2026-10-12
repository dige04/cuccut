/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** A marker object stored in the deck index to record how the deck came to live in files. */
export type FileMigrationMarkerRecord = Record<string, unknown>;
/** Which migration a deck's index records, with the marker itself. */
export interface FileMigrationMarkerRead {
  kind: "converted" | "created";
  marker: FileMigrationMarkerRecord;
}
/** Written to a deck that was created directly on files. */
export interface CreatedOnFilesMarker {
  v: 1;
  at: string;
}
/** Left behind in the old location when a deck moved elsewhere. */
export interface MovedToMarker {
  path: string;
  at: string;
  dropping?: string;
  dropped?: string;
  took?: string;
  [field: string]: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    CREATED_ON_FILES_MARKER_FIELD: string;
    isFileMigrationMarkerObject: (
      input: unknown,
    ) => input is FileMigrationMarkerRecord;
    readFileMigrationMarker: (record: unknown) => FileMigrationMarkerRead | null;
    createdOnFilesMarker: (marker: { at: string }) => CreatedOnFilesMarker;
    readMovedToMarker: (record: unknown) => MovedToMarker | null;
  }
}

export function installDocumentsMigrationMarkers(
  runtime: RuntimeBindings,
): () => void {
  var CREATED_ON_FILES_MARKER_FIELD: string;
  var isFileMigrationMarkerObject: (
    input: unknown,
  ) => input is FileMigrationMarkerRecord;
  function readFileMigrationMarker(
    record: unknown,
  ): FileMigrationMarkerRead | null {
    if (!isFileMigrationMarkerObject(record)) {
      return null;
    }
    let convertedFrom = record.convertedFrom;
    if (isFileMigrationMarkerObject(convertedFrom)) {
      return {
        kind: "converted",
        marker: convertedFrom,
      };
    }
    let createdOnFiles = record.createdOnFiles;
    if (isFileMigrationMarkerObject(createdOnFiles)) {
      return {
        kind: "created",
        marker: createdOnFiles,
      };
    }
    return null;
  }
  function createdOnFilesMarker(marker: { at: string }): CreatedOnFilesMarker {
    return {
      v: 1,
      at: marker.at,
    };
  }
  function readMovedToMarker(record: unknown): MovedToMarker | null {
    if (!isFileMigrationMarkerObject(record)) {
      return null;
    }
    let movedTo = record.movedTo;
    if (
      !isFileMigrationMarkerObject(movedTo) ||
      typeof movedTo.path !== "string" ||
      typeof movedTo.at !== "string"
    ) {
      return null;
    }
    let marker = {
      ...movedTo,
    } as MovedToMarker;
    for (let value of ["dropping", "dropped", "took"])
      if (typeof marker[value] !== "string") {
        delete marker[value];
      }
    return marker;
  }
  bindRuntimeValue(
    runtime,
    "CREATED_ON_FILES_MARKER_FIELD",
    () => CREATED_ON_FILES_MARKER_FIELD,
    (value) => {
      CREATED_ON_FILES_MARKER_FIELD = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isFileMigrationMarkerObject",
    () => isFileMigrationMarkerObject,
    (value) => {
      isFileMigrationMarkerObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readFileMigrationMarker",
    () => readFileMigrationMarker,
  );
  bindRuntimeValue(runtime, "createdOnFilesMarker", () => createdOnFilesMarker);
  bindRuntimeValue(runtime, "readMovedToMarker", () => readMovedToMarker);
  return () => {
    CREATED_ON_FILES_MARKER_FIELD = "createdOnFiles";
    isFileMigrationMarkerObject = (
      input: unknown,
    ): input is FileMigrationMarkerRecord =>
      typeof input === "object" && input !== null && !Array.isArray(input);
  };
}
