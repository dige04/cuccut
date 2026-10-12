/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelDomText(
  runtime: RuntimeBindings,
): () => void {
  var isDirectiveElement: Dynamic;
  var directiveParent: Dynamic;
  var ModelDomTextSubscribers: Dynamic;
  var ModelDomTextSplitValue: Dynamic;
  var ModelDomTextSplitValue_2: Dynamic;
  var ModelDomTextH1H2H3Config: Dynamic;
  var ModelDomTextButtonInputPattern: Dynamic;
  var ModelDomTextRegistry: Dynamic;
  function editorAssert(
    input?: Dynamic,
    options?: Dynamic,
    ...context: Dynamic[]
  ): Dynamic {
    input || console.error(`[dc-editor] ${options}`, ...context);
  }
  function hasOnlyDirectText(input?: Dynamic): Dynamic {
    let flag: Dynamic = false;
    for (let value of input.childNodes as Dynamic) {
      if (value.nodeType === Node.ELEMENT_NODE) return false;
      value.nodeType === Node.TEXT_NODE &&
        (value.nodeValue ?? "").trim().length > 0 &&
        (flag = true);
    }
    return flag;
  }
  function elementTextPreview(input?: Dynamic, options: Dynamic = 40): Dynamic {
    let text: Dynamic = "",
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        for (let value of input2.childNodes as Dynamic) {
          if (text.length >= options) return;
          if (value.nodeType === Node.TEXT_NODE) {
            let value2: Dynamic = (value.nodeValue ?? "").trim();
            value2 && (text += (text ? " " : "") + value2);
          } else
            value.nodeType === Node.ELEMENT_NODE &&
              !/^(style|script|template|sc-helmet)$/i.test(value.tagName) &&
              callback(value);
        }
      };
    callback(input);
    return text;
  }
  function siblingsSeparatedOnlyByWhitespace(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let nextSibling: Dynamic = input.nextSibling;
    for (; nextSibling && nextSibling !== options; ) {
      if (
        nextSibling.nodeType !== Node.TEXT_NODE ||
        (nextSibling.nodeValue ?? "").trim().length > 0
      )
        return false;
      nextSibling = nextSibling.nextSibling;
    }
    return nextSibling === options;
  }
  function nextDirectiveSibling(input?: Dynamic): Dynamic {
    let value: Dynamic = input;
    for (;;) {
      for (; !value.nextSibling && isDirectiveElement(value.parentNode); )
        value = value.parentNode;
      let nextSibling: Dynamic = value.nextSibling;
      for (; isDirectiveElement(nextSibling) && nextSibling.firstChild; )
        nextSibling = nextSibling.firstChild;
      if (!isDirectiveElement(nextSibling)) return nextSibling;
      value = nextSibling;
    }
  }
  function directiveSiblingsAdjacent(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = nextDirectiveSibling(input);
    for (; value && value !== options; ) {
      if (
        value.nodeType !== Node.TEXT_NODE ||
        (value.nodeValue ?? "").trim().length > 0
      )
        return false;
      value = nextDirectiveSibling(value);
    }
    return value === options;
  }
  function containsTemplateText(input?: Dynamic): Dynamic {
    if (input.nodeType === Node.TEXT_NODE)
      return (input.nodeValue ?? "").includes("{{");
    for (let value of input.childNodes as Dynamic)
      if (containsTemplateText(value)) return true;
    return false;
  }
  bindRuntimeValue(runtime, "editorAssert", () => editorAssert);
  bindRuntimeValue(runtime, "hasOnlyDirectText", () => hasOnlyDirectText);
  bindRuntimeValue(runtime, "elementTextPreview", () => elementTextPreview);
  bindRuntimeValue(
    runtime,
    "siblingsSeparatedOnlyByWhitespace",
    () => siblingsSeparatedOnlyByWhitespace,
  );
  bindRuntimeValue(
    runtime,
    "isDirectiveElement",
    () => isDirectiveElement,
    (value) => {
      isDirectiveElement = value;
    },
  );
  bindRuntimeValue(runtime, "nextDirectiveSibling", () => nextDirectiveSibling);
  bindRuntimeValue(
    runtime,
    "directiveSiblingsAdjacent",
    () => directiveSiblingsAdjacent,
  );
  bindRuntimeValue(
    runtime,
    "directiveParent",
    () => directiveParent,
    (value) => {
      directiveParent = value;
    },
  );
  bindRuntimeValue(runtime, "containsTemplateText", () => containsTemplateText);
  bindRuntimeValue(
    runtime,
    "ModelDomTextSubscribers",
    () => ModelDomTextSubscribers,
    (value) => {
      ModelDomTextSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelDomTextSplitValue",
    () => ModelDomTextSplitValue,
    (value) => {
      ModelDomTextSplitValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelDomTextSplitValue_2",
    () => ModelDomTextSplitValue_2,
    (value) => {
      ModelDomTextSplitValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelDomTextH1H2H3Config",
    () => ModelDomTextH1H2H3Config,
    (value) => {
      ModelDomTextH1H2H3Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelDomTextButtonInputPattern",
    () => ModelDomTextButtonInputPattern,
    (value) => {
      ModelDomTextButtonInputPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ModelDomTextRegistry",
    () => ModelDomTextRegistry,
    (value) => {
      ModelDomTextRegistry = value;
    },
  );
  return () => {
    isDirectiveElement = (input?: Dynamic): Dynamic =>
      input?.nodeType === Node.ELEMENT_NODE &&
      /^(sc-if|sc-for)$/i.test(input.tagName);
    directiveParent = (input?: Dynamic): Dynamic => {
      let parentNode: Dynamic = input.parentNode;
      for (; isDirectiveElement(parentNode); )
        parentNode = parentNode.parentNode;
      return parentNode;
    };
    ModelDomTextSubscribers = new Set(
      "p h1 h2 h3 h4 h5 h6 span a li dt dd td th blockquote q cite label button figcaption caption code pre em strong b i u s small mark sub sup".split(
        " ",
      ),
    );
    ModelDomTextSplitValue =
      "font font-family font-size font-weight font-style line-height letter-spacing color text-align text-transform".split(
        " ",
      );
    ModelDomTextSplitValue_2 =
      "font-family font-size font-weight font-style line-height".split(" ");
    ModelDomTextH1H2H3Config = {
      h1: "font-size font-weight",
      h2: "font-size font-weight",
      h3: "font-size font-weight",
      h4: "font-size font-weight",
      h5: "font-size font-weight",
      h6: "font-size font-weight",
      b: "font-weight",
      strong: "font-weight",
      th: "font-weight text-align",
      caption: "text-align",
      center: "text-align",
      em: "font-style",
      i: "font-style",
      cite: "font-style",
      address: "font-style",
      dfn: "font-style",
      var: "font-style",
      code: "font-family",
      pre: "font-family",
      kbd: "font-family",
      samp: "font-family",
      tt: "font-family",
      small: "font-size",
      big: "font-size",
      sub: "font-size",
      sup: "font-size",
      rt: "font-size",
      mark: "color",
      dialog: "color",
    };
    ModelDomTextButtonInputPattern = /^(button|input|select|textarea)$/;
    ModelDomTextRegistry = {
      section: "Section",
      article: "Article",
      header: "Header",
      footer: "Footer",
      nav: "Nav",
      aside: "Aside",
      main: "Main",
      form: "Form",
      ul: "List",
      ol: "List",
      li: "List item",
      table: "Table",
      thead: "Table head",
      tbody: "Table body",
      tfoot: "Table foot",
      tr: "Table row",
      td: "Table cell",
      th: "Table cell",
      p: "Paragraph",
      h1: "Heading",
      h2: "Heading",
      h3: "Heading",
      h4: "Heading",
      h5: "Heading",
      h6: "Heading",
      a: "Link",
      img: "Image",
      picture: "Image",
      video: "Video",
      audio: "Audio",
      svg: "Graphic",
      canvas: "Canvas",
      iframe: "Embed",
      button: "Button",
      input: "Input",
      textarea: "Text area",
      select: "Select",
      figure: "Figure",
      figcaption: "Caption",
      caption: "Caption",
      blockquote: "Quote",
      hr: "Divider",
      rect: "Rectangle",
      circle: "Oval",
      ellipse: "Oval",
      line: "Line",
      polyline: "Path",
      polygon: "Polygon",
      path: "Path",
      text: "Text",
      tspan: "Text",
      textpath: "Text",
      image: "Image",
      symbol: "Symbol",
      use: "Linked copy",
      defs: "Definitions",
      marker: "Marker",
      clippath: "Clip path",
      mask: "Mask",
      lineargradient: "Gradient",
      radialgradient: "Gradient",
      stop: "Gradient stop",
      pattern: "Pattern",
      filter: "Filter",
      feblend: "Filter effect",
      fecolormatrix: "Filter effect",
      fecomponenttransfer: "Filter effect",
      fecomposite: "Filter effect",
      feconvolvematrix: "Filter effect",
      fediffuselighting: "Filter effect",
      fedisplacementmap: "Filter effect",
      fedistantlight: "Filter effect",
      fedropshadow: "Filter effect",
      feflood: "Filter effect",
      fefunca: "Filter effect",
      fefuncb: "Filter effect",
      fefuncg: "Filter effect",
      fefuncr: "Filter effect",
      fegaussianblur: "Filter effect",
      feimage: "Filter effect",
      femerge: "Filter effect",
      femergenode: "Filter effect",
      femorphology: "Filter effect",
      feoffset: "Filter effect",
      fepointlight: "Filter effect",
      fespecularlighting: "Filter effect",
      fespotlight: "Filter effect",
      fetile: "Filter effect",
      feturbulence: "Filter effect",
      animate: "Animation",
      animatemotion: "Animation",
      animatetransform: "Animation",
      set: "Animation",
      discard: "Animation",
      mpath: "Motion path",
      foreignobject: "Embedded HTML",
      desc: "Description",
      metadata: "Metadata",
      view: "View",
    };
  };
}
