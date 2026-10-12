/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureViewport(
  runtime: RuntimeBindings,
): () => void {
  var ExportCaptureViewportLimit: Dynamic;
  var ExportCaptureViewportLabel: Dynamic;
  var measureContentHeightScript: Dynamic;
  var ExportCaptureViewportConstant: Dynamic;
  var ExportCaptureViewportItems: Dynamic;
  var measureExportTailScript: Dynamic;
  async function lockCaptureViewport(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = null,
  ): Promise<Dynamic> {
    let value: Dynamic = await input
        .executeJavaScript("[window.scrollX,window.scrollY]", 2e3)
        .catch((): Dynamic => null),
      { unlock: value2, resized: value3 }: Dynamic = input.lockViewportSize(
        options.w,
        options.h,
      ),
      callback: Dynamic = (): Dynamic => {
        value2();
        (value3 || context) &&
          Array.isArray(value) &&
          value.every(
            (input2?: Dynamic): Dynamic =>
              typeof input2 == "number" && Number.isFinite(input2),
          ) &&
          input.executeJavaScriptUnchecked(
            "window.scrollTo(" +
              String(value[0]) +
              "," +
              String(value[1]) +
              ")",
          );
      };
    if (!value3 && !context)
      return {
        release: callback,
        settleMs: 0,
      };
    let index: Dynamic = 0;
    try {
      if (value3) {
        let value5: Dynamic = String(Number(options.w) || 0),
          value6: Dynamic = String(Number(options.h) || 0);
        await input
          .executeJavaScript(
            "new Promise(function(r){var n=0;(function t(){(Math.abs(window.innerWidth-" +
              value5 +
              ")<1&&Math.abs(window.innerHeight-" +
              value6 +
              ")<1)||++n>30?r(null):setTimeout(t,16)})()})",
            2e3,
          )
          .catch((): Dynamic => {});
      }
      let value4: Dynamic = Date.now();
      await input.awaitSettled(context ?? 1500);
      context && (index = Date.now() - value4);
    } catch (value4: Dynamic) {
      throw (callback(), value4);
    }
    return {
      release: callback,
      settleMs: index,
    };
  }
  async function measureArtboardContentHeight(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    return withCaptureViewport(input, options, async (): Promise<Dynamic> => {
      await input.awaitSettled(1500).catch((): Dynamic => {});
      let value: Dynamic = await input
        .executeJavaScript(measureContentHeightScript, 2e3)
        .catch((): Dynamic => null);
      return typeof value == "number" &&
        Number.isFinite(value) &&
        value >= 1 &&
        value <= 1e6
        ? value
        : null;
    });
  }
  async function measureExpandedContentHeight(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let value: Dynamic = await measureArtboardContentHeight(input, options);
    if (value === null || value <= options.h + runtime.exportHeightTolerance)
      return value;
    let value2: Dynamic = await measureArtboardContentHeight(input, {
      w: options.w,
      h: Math.min(
        runtime.PlatformFileContentLimit_6,
        Math.ceil(value),
        options.h + ExportCaptureViewportConstant,
      ),
    });
    return value2 !== null && value2 > value + runtime.exportHeightTolerance
      ? "unsettled"
      : value;
  }
  function normalizeExportTailMetrics(input?: Dynamic): Dynamic {
    if (typeof input != "object" || input === null) return null;
    let { h: value, g: value2, c: value3 }: Dynamic = input,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" &&
        Number.isFinite(input2) &&
        input2 >= 0 &&
        input2 <= 1e6;
    return callback(value) &&
      value >= 1 &&
      callback(value2) &&
      (value3 === 0 || value3 === 1)
      ? {
          h: value,
          g: value2,
          c: value3,
        }
      : null;
  }
  async function measureFlowExportHeight(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    let [value, value2]: Dynamic = ExportCaptureViewportItems,
      callback: Dynamic = (input2?: Dynamic): Dynamic =>
        withCaptureViewport(
          input,
          {
            w: options.w,
            h: input2,
          },
          async (): Promise<Dynamic> =>
            normalizeExportTailMetrics(
              await input
                .executeJavaScript(measureExportTailScript, 2e3)
                .catch((): Dynamic => null),
            ),
        ),
      value3: Dynamic = await callback(value);
    if (value3 === null) return null;
    if (value3.c === 1) return "unsettled";
    let value4: Dynamic = await callback(value2);
    if (value4 === null) return null;
    if (value4.c === 1) return "unsettled";
    let value5: Dynamic = value3.h > value + runtime.exportHeightTolerance,
      value6: Dynamic = value4.h > value2 + runtime.exportHeightTolerance,
      value7: Dynamic = Math.min(value3.g, value3.h),
      value8: Dynamic = Math.min(value4.g, value4.h),
      value9: Dynamic;
    if (value5) {
      if (
        value6 &&
        Math.abs(value4.h - value3.h) > runtime.exportHeightTolerance
      )
        return "unsettled";
      value9 = Math.max(value3.h, value7);
    } else {
      if (value6 || Math.abs(value8 - value7) > runtime.exportHeightTolerance)
        return "unsettled";
      if (value7 < 1) return "empty";
      value9 = Math.max(value7, value8);
    }
    for (
      let index: Dynamic = 0;
      value9 + runtime.exportHeightTolerance < options.h;
      index++
    ) {
      let value10: Dynamic = await measureArtboardContentHeight(input, {
        w: options.w,
        h: Math.ceil(value9),
      });
      if (value10 === null) return null;
      if (value10 <= Math.ceil(value9) + runtime.exportHeightTolerance) break;
      if (index === 1) return "unsettled";
      value9 = value10;
    }
    return Math.min(value9, options.h);
  }
  async function measureEmptyExportTail(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = 2500,
  ): Promise<Dynamic> {
    return withCaptureViewport(input, options, async (): Promise<Dynamic> => {
      let value: Dynamic = normalizeExportTailMetrics(
        await input
          .executeJavaScript(measureExportTailScript, context)
          .catch((): Dynamic => null),
      );
      return value === null ||
        value.c === 1 ||
        value.g < 1 ||
        value.h > options.h + runtime.exportHeightTolerance
        ? null
        : Math.max(0, Math.round(options.h - value.g));
    });
  }
  async function withCaptureViewport(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = false,
  ): Promise<Dynamic> {
    if (!options) return context(0);
    let { release: value2, settleMs: value3 }: Dynamic =
      await lockCaptureViewport(
        input,
        options,
        value
          ? runtime.ExportDeliveryCapMsFinishAnimationsEagerImagesConfig
          : null,
      );
    try {
      return await context(value3);
    } finally {
      value2();
    }
  }
  bindRuntimeValue(runtime, "lockCaptureViewport", () => lockCaptureViewport);
  bindRuntimeValue(
    runtime,
    "ExportCaptureViewportLimit",
    () => ExportCaptureViewportLimit,
    (value) => {
      ExportCaptureViewportLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ExportCaptureViewportLabel",
    () => ExportCaptureViewportLabel,
    (value) => {
      ExportCaptureViewportLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "measureContentHeightScript",
    () => measureContentHeightScript,
    (value) => {
      measureContentHeightScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "measureArtboardContentHeight",
    () => measureArtboardContentHeight,
  );
  bindRuntimeValue(
    runtime,
    "ExportCaptureViewportConstant",
    () => ExportCaptureViewportConstant,
    (value) => {
      ExportCaptureViewportConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "measureExpandedContentHeight",
    () => measureExpandedContentHeight,
  );
  bindRuntimeValue(
    runtime,
    "ExportCaptureViewportItems",
    () => ExportCaptureViewportItems,
    (value) => {
      ExportCaptureViewportItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "measureExportTailScript",
    () => measureExportTailScript,
    (value) => {
      measureExportTailScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeExportTailMetrics",
    () => normalizeExportTailMetrics,
  );
  bindRuntimeValue(
    runtime,
    "measureFlowExportHeight",
    () => measureFlowExportHeight,
  );
  bindRuntimeValue(
    runtime,
    "measureEmptyExportTail",
    () => measureEmptyExportTail,
  );
  bindRuntimeValue(runtime, "withCaptureViewport", () => withCaptureViewport);
  return () => {
    ExportCaptureViewportLimit = 15e3;
    ExportCaptureViewportLabel =
      "the artboard changed while it was being paginated";
    measureContentHeightScript =
      "(function(){var d=document.documentElement,b=document.body,o=function(e){return e?getComputedStyle(e).overflowY:''};return /hidden|clip/.test(o(d)+o(b))?window.innerHeight:Math.max(d.scrollHeight,b?b.scrollHeight:0)})()";
    ExportCaptureViewportConstant = 480;
    ExportCaptureViewportItems = [240, 400];
    measureExportTailScript =
      "(function(){var d=document.documentElement,b=document.body;if(!b)return null;var cs=function(e){return getComputedStyle(e)};if(/hidden|clip/.test(cs(d).overflowY+cs(b).overflowY))return{h:window.innerHeight,g:0,c:1};var sh=Math.max(d.scrollHeight,b.scrollHeight),sw=d.clientWidth,g=0,sy=window.scrollY,sx=window.scrollX;var media={IMG:1,SVG:1,svg:1,CANVAS:1,VIDEO:1,PICTURE:1,INPUT:1,BUTTON:1,TEXTAREA:1,SELECT:1,IFRAME:1,HR:1};var cv=null,seen={};try{cv=document.createElement('canvas');cv.width=cv.height=1;cv=cv.getContext('2d',{willReadFrequently:true})}catch(e){cv=null}var rgb=function(v){if(!v||v==='transparent')return null;var m=/^rgba?\\(([^)]+)\\)/.exec(v),p;if(m){p=m[1].split(',').map(parseFloat);return p.length>3&&!(p[3]>0.05)?null:p}if(!cv)return null;if(v in seen)return seen[v];try{cv.clearRect(0,0,1,1);cv.fillStyle='rgba(0,0,0,0)';cv.fillStyle=v;cv.fillRect(0,0,1,1);p=cv.getImageData(0,0,1,1).data;seen[v]=p[3]>12?[p[0],p[1],p[2]]:null}catch(e){seen[v]=null}return seen[v]};var behind=function(e){for(;e;e=e.parentElement){var c=rgb(cs(e).backgroundColor);if(c)return c}return[255,255,255]};var all=b.querySelectorAll('*'),n=Math.min(all.length,20000),fixed=new Map();for(var i=0;i<n;i++){var el=all[i],t=el.tagName;if(t==='SCRIPT'||t==='STYLE'||t==='TEMPLATE'||t==='LINK')continue;if(!media[t]&&el.namespaceURI!=='http://www.w3.org/1999/xhtml')continue;var s=cs(el),f=s.position==='fixed'||fixed.get(el.parentElement)===true;fixed.set(el,f);if(f)continue;if((el.checkVisibility?!el.checkVisibility({visibilityProperty:true}):(s.display==='none'||s.visibility==='hidden'))||parseFloat(s.opacity)===0)continue;var r=el.getBoundingClientRect();if(!(r.width>0&&r.height>0))continue;var top=r.top+sy,bot=r.bottom+sy;if(top<=24&&bot>=sh-24&&(r.width>=sw*0.6||(r.left+sx>24&&r.right+sx<sw-24)))continue;var has=!!media[t]||s.backgroundImage!=='none'||(s.borderBottomStyle!=='none'&&parseFloat(s.borderBottomWidth)>0);if(!has)for(var c=el.firstChild;c;c=c.nextSibling)if(c.nodeType===3&&c.textContent.trim()){has=true;break}if(!has&&r.height>=40){var own=rgb(s.backgroundColor);if(own){var bh=behind(el.parentElement);if(Math.abs(own[0]-bh[0])+Math.abs(own[1]-bh[1])+Math.abs(own[2]-bh[2])>24)has=true}}if(has&&bot>g)g=bot}return{h:sh,g:all.length>n?0:Math.ceil(g),c:0}})()";
  };
}
