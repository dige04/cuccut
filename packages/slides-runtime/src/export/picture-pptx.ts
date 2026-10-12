/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide } from "../deck-contracts";

type PptxPresentationInstance = InstanceType<
  RuntimeBindings["PptxPresentation"]
>;

/** The text a captured slide page carries, which becomes the picture's alt text. */
export interface PicturePageText {
  textRuns: readonly { text: string }[];
}
/** A captured slide page: its JPEG bytes plus the text read from the slide. */
export interface PicturePageCapture extends PicturePageText {
  jpeg: Uint8Array;
}
export interface PicturePptxTestHooks {
  PICTURE_ALT_MAX: number;
  pictureAlt: (slide: PicturePageText) => string;
}
export interface PicturePptxExports {
  slidePicturesToPptxBlob: (
    title: string,
    slides: readonly Slide[],
    captures: readonly PicturePageCapture[],
  ) => Promise<Blob>;
  _test: PicturePptxTestHooks;
}

declare module "../bindings" {
  interface RuntimeBindings {
    picturePptxExports: PicturePptxExports;
    /** Longest alt text, in characters, given to a slide picture. */
    PICTURE_ALT_MAX: number;
    picturePptxTestHooks: PicturePptxTestHooks;
    initializePicturePptx: () => void;
    pictureAltText: PicturePptxTestHooks["pictureAlt"];
    slidePicturesToPptxBlob: PicturePptxExports["slidePicturesToPptxBlob"];
  }
}

export function installExportPicturePptx(runtime: RuntimeBindings): () => void {
  var picturePptxExports: RuntimeBindings["picturePptxExports"];
  var PICTURE_ALT_MAX: RuntimeBindings["PICTURE_ALT_MAX"];
  var picturePptxTestHooks: RuntimeBindings["picturePptxTestHooks"];
  var initializePicturePptx: RuntimeBindings["initializePicturePptx"];
  function pictureAltText(slide: PicturePageText): string {
    return (0, runtime.normalizeDescription)(
      slide.textRuns.map((input) => input.text).join(" "),
      PICTURE_ALT_MAX,
    );
  }
  async function slidePicturesToPptxBlob(
    title: string,
    slides: readonly Slide[],
    captures: readonly PicturePageCapture[],
  ): Promise<Blob> {
    if (slides.length !== captures.length) {
      throw Error("one captured page per slide expected");
    }
    let value: PptxPresentationInstance = (0, runtime.createPptxPresentation)(
        title,
      ),
      value2: number = (0, runtime.pxToInches)(runtime.SLIDE_WIDTH),
      value3: number = (0, runtime.pxToInches)(runtime.SLIDE_HEIGHT);
    value.defineLayout({
      name: "APPIFACT",
      width: value2,
      height: value3,
    });
    value.layout = "APPIFACT";
    captures.forEach((input, options): void => {
      let value4 = value.addSlide(),
        value5 = "Slide " + String(options + 1);
      value4.addImage({
        data:
          "data:image/jpeg;base64," + (0, runtime.bytesToBase64)(input.jpeg),
        x: 0,
        y: 0,
        w: value2,
        h: value3,
        altText: pictureAltText(input) || value5,
        objectName: value5,
      });
      let notes = slides[options]!.notes;
      if (notes !== undefined) {
        value4.addNotes(notes);
      }
    });
    return (await value.write({
      outputType: "blob",
      compression: false,
    })) as Blob;
  }
  bindRuntimeValue(
    runtime,
    "picturePptxExports",
    () => picturePptxExports,
    (value) => {
      picturePptxExports = value;
    },
  );
  bindRuntimeValue(runtime, "pictureAltText", () => pictureAltText);
  bindRuntimeValue(
    runtime,
    "slidePicturesToPptxBlob",
    () => slidePicturesToPptxBlob,
  );
  bindRuntimeValue(
    runtime,
    "PICTURE_ALT_MAX",
    () => PICTURE_ALT_MAX,
    (value) => {
      PICTURE_ALT_MAX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "picturePptxTestHooks",
    () => picturePptxTestHooks,
    (value) => {
      picturePptxTestHooks = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializePicturePptx",
    () => initializePicturePptx,
    (value) => {
      initializePicturePptx = value;
    },
  );
  return () => {
    picturePptxExports = {} as PicturePptxExports;
    (0, runtime.defineLiveExports)(picturePptxExports, {
      slidePicturesToPptxBlob: () => slidePicturesToPptxBlob,
      _test: () => picturePptxTestHooks,
    });
    PICTURE_ALT_MAX = 1000;
    initializePicturePptx = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializePptxExport)();
      picturePptxTestHooks = {
        PICTURE_ALT_MAX: PICTURE_ALT_MAX,
        pictureAlt: pictureAltText,
      };
    });
  };
}
