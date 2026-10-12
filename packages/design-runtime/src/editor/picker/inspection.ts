/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPickerInspection(
  runtime: RuntimeBindings,
): () => void {
  async function inspectPickerCssVariables(
    input?: Dynamic,
    items?: Dynamic,
  ): Promise<Dynamic> {
    if (items.length === 0)
      return {
        vars: new Set(),
        settled: true,
      };
    try {
      let value: Dynamic = await input.executeJavaScript(
        `(function(ns){var done=document.readyState==='complete',settled=done;var ls=document.querySelectorAll('link[rel~="stylesheet"][href]:not([disabled]):not([rel~="alternate"])');for(var j=0;j<ls.length;j++){if(!ls[j].sheet){if(!done)return null;settled=false}}var cs=getComputedStyle(document.documentElement);var out=[];for(var i=0;i<ns.length;i++){if(cs.getPropertyValue(ns[i]).trim())out.push(ns[i])}return {vars:out,settled:settled}})(${JSON.stringify(items)})`,
        4e3,
      );
      return value
        ? {
            vars: new Set(value.vars),
            settled: value.settled === true,
          }
        : null;
    } catch {
      return null;
    }
  }
  function observePickerCssVariables(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let flag: Dynamic = false,
      value: Dynamic = [0, 300, 1e3, 2e3, 5e3, 12e3, 3e4].map(
        (input2?: Dynamic): Dynamic =>
          setTimeout((): Dynamic => {
            inspectPickerCssVariables(input, options).then(
              (input3?: Dynamic): Dynamic => {
                flag ||
                  !input3 ||
                  (input3.vars.size === 0 && !input3.settled && input2 < 5e3) ||
                  context(input3.vars);
              },
            );
          }, input2),
      );
    return (): Dynamic => {
      flag = true;
      value.forEach(clearTimeout);
    };
  }
  function sameStringSet(input?: Dynamic, options?: Dynamic): Dynamic {
    return (
      input !== undefined &&
      input.size === options.size &&
      [...options].every((input2?: Dynamic): Dynamic => input.has(input2))
    );
  }
  async function getPickerFontFaces(input?: Dynamic): Promise<Dynamic> {
    try {
      let value: Dynamic = await input.executeJavaScript(
        "(function(){var o=[],seen={};document.fonts.forEach(function(f){var k=f.family+'|'+f.weight+'|'+f.style;if(f.status!=='error'&&!seen[k]){seen[k]=1;o.push({family:f.family,weight:f.weight,style:f.style})}});return o})()",
        4e3,
      );
      return Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }
  async function inspectPickerProps(
    input?: Dynamic,
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic = Object.create(null);
    try {
      let value2: Dynamic = await input.executeJavaScript(
        `(function(){try{var n=window.__dcRootName&&window.__dcRootName();var r=n&&window.__dcRegistry&&window.__dcRegistry[n];if(!r||!r.Logic)return null;var v=new r.Logic(${JSON.stringify(options)}).renderVals();if(!v||typeof v!=='object')return null;var o={},c=0;for(var k in v){if(c>=200)break;var x=v[k],t=typeof x;if(x===null||t==='boolean'||(t==='number'&&isFinite(x))||(t==='string'&&x.length<=4000)){o[k]=x;c++;}}return JSON.stringify(o)}catch(e){return null}})()`,
        1500,
      );
      if (typeof value2 != "string" || value2.length > 4e5) return value;
      let value3: Dynamic = JSON.parse(value2);
      if (!value3 || typeof value3 != "object" || Array.isArray(value3))
        return value;
      let index: Dynamic = 0;
      for (let [value4, value5] of Object.entries(value3) as Dynamic)
        index >= 200 ||
          !/^[A-Za-z_$][\w$]*$/.test(value4) ||
          value4 === "__proto__" ||
          value4 === "constructor" ||
          ((value5 === null ||
            typeof value5 == "boolean" ||
            (typeof value5 == "number" && Number.isFinite(value5)) ||
            (typeof value5 == "string" && value5.length <= 4e3)) &&
            ((value[value4] = value5), index++));
    } catch {}
    return value;
  }
  async function getPickerComponentScript(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value: Dynamic = await input.executeJavaScript(
        `(function(){try{if(!window.__dcRegistry)return null;var r=window.__dcRegistry[${JSON.stringify(options)}];if(!r)return 'missing';if(!r.Logic)return JSON.stringify({l:false,v:{},h:[]});var v=new r.Logic(${JSON.stringify(context)}).renderVals()||{};if(typeof v!=='object')return null;var o={},h=[],c=0;for(var k in v){if(++c>200)return 'big';var x=v[k],t=typeof x;if(x===null||t==='boolean'||(t==='number'&&isFinite(x))||(t==='string'&&x.length<=4000))o[k]=x;else h.push(k)}return JSON.stringify({l:true,v:o,h:h})}catch(e){return null}})()`,
        1500,
      );
      if (value === "missing" || value === "big") return value;
      if (typeof value != "string") return null;
      if (value.length > 4e5) return "big";
      let value2: Dynamic = JSON.parse(value);
      if (
        !value2 ||
        typeof value2.l != "boolean" ||
        !value2.v ||
        typeof value2.v != "object" ||
        Array.isArray(value2.v) ||
        !Array.isArray(value2.h)
      )
        return null;
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
          typeof input2 == "string" &&
          /^[A-Za-z_$][\w$]*$/.test(input2) &&
          input2 !== "__proto__" &&
          input2 !== "constructor",
        value3: Dynamic = Object.create(null),
        value4: Dynamic = value2.h.filter(callback);
      for (let [value5, value6] of Object.entries(value2.v) as Dynamic)
        callback(value5) &&
        (value6 === null ||
          typeof value6 == "boolean" ||
          (typeof value6 == "number" && Number.isFinite(value6)) ||
          (typeof value6 == "string" && value6.length <= 4e3))
          ? (value3[value5] = value6)
          : value4.push(value5);
      return {
        hasLogic: value2.l,
        vals: value3,
        held: value4,
      };
    } catch {
      return null;
    }
  }
  async function getPickerPropsMetadata(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value: Dynamic = await input.executeJavaScript(
        `(function(){try{var r=window.__dcRegistry&&window.__dcRegistry[${JSON.stringify(options)}];return r&&r.propsMeta?JSON.stringify(r.propsMeta):null}catch(e){return null}})()`,
        4e3,
      );
      return typeof value != "string" ? null : JSON.parse(value);
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "inspectPickerCssVariables",
    () => inspectPickerCssVariables,
  );
  bindRuntimeValue(
    runtime,
    "observePickerCssVariables",
    () => observePickerCssVariables,
  );
  bindRuntimeValue(runtime, "sameStringSet", () => sameStringSet);
  bindRuntimeValue(runtime, "getPickerFontFaces", () => getPickerFontFaces);
  bindRuntimeValue(runtime, "inspectPickerProps", () => inspectPickerProps);
  bindRuntimeValue(
    runtime,
    "getPickerComponentScript",
    () => getPickerComponentScript,
  );
  bindRuntimeValue(
    runtime,
    "getPickerPropsMetadata",
    () => getPickerPropsMetadata,
  );
  return () => {};
}
