/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorPropertiesAppearanceSection(
  runtime: RuntimeBindings,
): () => void {
  var jsxPropertiesAppearanceSection: Dynamic;
  var PropertiesAppearanceSectionFallback: Dynamic;
  var PropertiesInheritedFieldValueAlias_2: Dynamic;
  var PropertiesInheritedFieldMixedAlias_2: Dynamic;
  var PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues: Dynamic;
  var PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues: Dynamic;
  var PropertiesAppearanceSectionItems: Dynamic;
  var PropertiesAppearanceSectionMapValue: Dynamic;
  var jsxPropertiesAppearanceSection_2: Dynamic;
  var jsxPropertiesAppearanceSection_3: Dynamic;
  var PropertiesAppearanceSectionSubscribers: Dynamic;
  var PropertiesAppearanceSectionSubscribers_2: Dynamic;
  var PropertiesAppearanceSectionLabel: Dynamic;
  var PropertiesAppearanceSectionLabel_2: Dynamic;
  var ACanvasPictureShowsAnUploadedMessage: Dynamic;
  var PropertiesAppearanceSectionLabel_3: Dynamic;
  var PropertiesAppearanceSectionLabel_4: Dynamic;
  var PropertiesAppearanceSectionLabel_5: Dynamic;
  var PropertiesAppearanceSectionItems_2: Dynamic;
  var PropertiesAppearanceSectionLabel_6: Dynamic;
  var PropertiesAppearanceSectionLabel_7: Dynamic;
  var PropertiesAppearanceSectionImageVideoRectConfig: Dynamic;
  var PropertiesAppearanceSectionWidthHeightPositionSet: Dynamic;
  var PropertiesAppearanceSectionNoteTitle1Config: Dynamic;
  var PropertiesAppearanceSectionSubscribers_3: Dynamic;
  var PropertiesAppearanceSectionBoxShadowFilterBackdropFilterSet: Dynamic;
  var PropertiesAppearanceSectionFontSizeFontWeightSet: Dynamic;
  var PropertiesAppearanceSectionHandler: Dynamic;
  var PropertiesAppearanceSectionImageRectOvalConfig: Dynamic;
  function isLongTailPropertyVisible(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    return (
      !input.spec?.longTail ||
      (input.value != null &&
        input.value !== "" &&
        input.value !== input.spec.defaultValue) ||
      (input.companionValue != null && input.companionValue !== "") ||
      !!input.mixed ||
      !!input.companionMixed ||
      options.has(input.prop)
    );
  }
  function filterLongTailProperties(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    return input.filter(
      (input2?: Dynamic): Dynamic =>
        context || !isLongTailPropertyVisible(input2, options),
    );
  }
  function PropertyCornerRadius({
    radius: radius,
    corners: corners,
    renderRows: renderRows,
    onCommitMany: onCommitMany,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useStyleCommitScrub)(
        (input?: Dynamic): Dynamic => onCommitMany(input),
      ),
      value2: Dynamic =
        PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues.map(
          (input?: Dynamic): Dynamic =>
            corners.find((input2?: Dynamic): Dynamic => input2.prop === input),
        ),
      callback: Dynamic = (): Dynamic => (
        <jsxPropertiesAppearanceSection.Fragment>
          {renderRows([
            radius,
            ...value2.filter(
              (input?: Dynamic): Dynamic =>
                !!input && PropertiesInheritedFieldValueAlias_2(input),
            ),
          ])}
        </jsxPropertiesAppearanceSection.Fragment>
      );
    if (value2.some((input?: Dynamic): Dynamic => !input)) return callback();
    let value3: Dynamic = null,
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        let value15: Dynamic = (input ?? "").trim();
        if (!value15) return;
        let value16: Dynamic = (0, runtime.parseCssNumber)(value15);
        if (!value16) return "bad";
        let value17: Dynamic = value16.unit || "px";
        return value3 != null && value3 !== value17
          ? "bad"
          : ((value3 = value17), value16.value);
      };
    for (let value15 of [radius, ...value2] as Dynamic)
      if (!value15.mixed && callback2(value15.value) === "bad")
        return callback();
    let value4: Dynamic = value2.every(
        (input?: Dynamic): Dynamic =>
          PropertiesInheritedFieldValueAlias_2(input) && !input.inheritedFrom,
      ),
      value5: Dynamic = (0, runtime.inheritedFieldsDisabledReason)(
        ...(value4 ? [] : [radius]),
        ...value2,
      ),
      value6: Dynamic = (0, runtime.inheritedFieldsDescription)(
        ...(value4 ? [] : [radius]),
        ...value2,
      ),
      value7: Dynamic = (0, runtime.inheritedFieldForEdit)(radius),
      value8: Dynamic = value2.map(
        (input?: Dynamic): Dynamic => (0, runtime.inheritedFieldForEdit)(input),
      ),
      value9: Dynamic = value7.mixed ? undefined : callback2(value7.value);
    if (value9 === "bad") return callback();
    let items: Dynamic = [undefined, undefined, undefined, undefined];
    for (let index: Dynamic = 0; index < 4; index++) {
      let value15: Dynamic = value8[index].mixed
        ? undefined
        : callback2(value8[index].value);
      if (value15 === "bad") return callback();
      items[index] = value15 !== undefined ? value15 : value9;
    }
    let value10: Dynamic = value3 ?? "px",
      items2: Dynamic = [
        PropertiesAppearanceSectionFallback(value8[0], value10),
        PropertiesAppearanceSectionFallback(value8[1], value10),
        PropertiesAppearanceSectionFallback(value8[2], value10),
        PropertiesAppearanceSectionFallback(value8[3], value10),
      ],
      value11: Dynamic =
        !!value7.mixed ||
        value8.some((input?: Dynamic): Dynamic => input.mixed),
      value12: Dynamic =
        PropertiesInheritedFieldMixedAlias_2(value7) ||
        value8.some(PropertiesInheritedFieldMixedAlias_2),
      value13: Dynamic =
        PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues.map(
          (input?: Dynamic): Dynamic => ({
            prop: input,
            value: null,
          }),
        ),
      value14: Dynamic =
        (0, runtime.getFineUnitStep)(value10, undefined) != null,
      callback3: Dynamic = (items3?: Dynamic, options?: Dynamic): Dynamic => {
        if (
          items3.length === 4 &&
          items3.every(
            (input?: Dynamic): Dynamic => input.value === items3[0].value,
          )
        ) {
          let value15: Dynamic = items3[0].value;
          options([
            {
              prop: "border-radius",
              value:
                value15 === undefined
                  ? null
                  : (0, runtime.formatCssNumber)(value15, value10),
            },
            ...value13,
          ]);
          return;
        }
        if (
          value7.mixed ||
          value2.some((input?: Dynamic): Dynamic => input.mixed)
        ) {
          options(
            items3.map(
              (input?: Dynamic): Dynamic => ({
                prop: PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues[
                  input.side
                ],
                value:
                  input.value === undefined
                    ? null
                    : (0, runtime.formatCssNumber)(input.value, value10),
              }),
            ),
          );
          return;
        }
        let items4: Dynamic = [...items];
        for (let value15 of items3 as Dynamic)
          items4[value15.side] = value15.value;
        options([
          {
            prop: "border-radius",
            value: null,
          },
          ...PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues.map(
            (input?: Dynamic, options2?: Dynamic): Dynamic => ({
              prop: input,
              value:
                items4[options2] === undefined
                  ? null
                  : (0, runtime.formatCssNumber)(items4[options2], value10),
            }),
          ),
        ]);
      };
    return (
      <runtime.PropertyCornersRow
        label={"Radius"}
        data-testid={"dc-radius"}
        title={value5}
        description={value6}
        values={items}
        placeholders={items2}
        unit={value10}
        min={0}
        step={value14 ? 0.1 : undefined}
        smallStep={value14 ? 0.01 : undefined}
        mixed={value11}
        disabled={
          radius.disabled ||
          value8.some((input?: Dynamic): Dynamic => input.disabled)
        }
        onSides={(input?: Dynamic): Dynamic => callback3(input, onCommitMany)}
        onScrubSides={(input?: Dynamic): Dynamic =>
          callback3(input, value.onScrub)
        }
        onScrubEnd={(): Dynamic => value.onScrubEnd()}
        onReset={
          value12
            ? (): Dynamic =>
                onCommitMany([
                  {
                    prop: "border-radius",
                    value: null,
                  },
                  ...value13,
                ])
            : undefined
        }
      />
    );
  }
  function PropertyBorderSection({
    rows: rows,
    renderRows: renderRows,
    renderRow: renderRow,
    onCommitMany: onCommitMany,
    hasInline: hasInline,
    classHasBorder: classHasBorder,
    uaBorder: uaBorder,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useStyleCommitScrub)(
        (input?: Dynamic): Dynamic => onCommitMany(input),
      ),
      value2: Dynamic = rows.find(
        (input?: Dynamic): Dynamic => input.prop === "border-style",
      ),
      value3: Dynamic = rows.find(
        (input?: Dynamic): Dynamic => input.prop === "border-width",
      ),
      value4: Dynamic =
        PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues.map(
          (input?: Dynamic): Dynamic =>
            rows.find((input2?: Dynamic): Dynamic => input2.prop === input),
        ),
      value5: Dynamic = (0, runtime.inheritedFieldForEdit)(value2),
      value6: Dynamic = (0, runtime.inheritedFieldForEdit)(value3),
      value7: Dynamic = rows.find(
        (input?: Dynamic): Dynamic => input.prop === "border-color",
      ),
      value8: Dynamic = value4.map(
        (input?: Dynamic): Dynamic => (0, runtime.inheritedFieldForEdit)(input),
      );
    if (
      !value5 ||
      !value6 ||
      !value7 ||
      value8.some((input?: Dynamic): Dynamic => !input)
    )
      return (
        <jsxPropertiesAppearanceSection.Fragment>
          {renderRows(rows.filter(PropertiesInheritedFieldValueAlias_2))}
        </jsxPropertiesAppearanceSection.Fragment>
      );
    let value9: Dynamic = value8,
      value10: Dynamic = value2
        ? (0, runtime.inheritedFieldTooltip)(value2)
        : undefined,
      value11: Dynamic = value2
        ? (0, runtime.inheritedFieldDescription)(value2)
        : undefined,
      value12: Dynamic = (0, runtime.inheritedFieldsDisabledReason)(
        value3,
        ...value4,
      ),
      value13: Dynamic = (0, runtime.inheritedFieldsDescription)(
        value3,
        ...value4,
      ),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        PropertiesAppearanceSectionItems.some(
          (input2?: Dynamic): Dynamic => input2.value === input,
        ),
      value14: Dynamic = (
        (value5.mixed ? "" : value5.value) ||
        value5.fallback ||
        "none"
      )
        .trim()
        .toLowerCase(),
      value15: Dynamic =
        value14 === "hidden"
          ? "none"
          : !PropertiesInheritedFieldValueAlias_2(value2) &&
              value14 !== "none" &&
              !callback(value14)
            ? "solid"
            : value14,
      value16: Dynamic = callback(value15),
      value17: Dynamic = (0, runtime.parseCssNumber)(
        ((value6.value || value6.fallback) ?? "").trim(),
      ),
      value18: Dynamic = value9.map(
        (input?: Dynamic): Dynamic =>
          (0, runtime.parseCssNumber)(
            ((input.value || input.fallback) ?? "").trim(),
          ),
      ),
      value19: Dynamic = value18.some(
        (input?: Dynamic): Dynamic => input != null && input.value > 0,
      ),
      value20: Dynamic =
        value16 &&
        value15 !== "none" &&
        ((value17?.value ?? 0) > 0 ||
          value19 ||
          (!value17 && !value18.some(Boolean))),
      value21: Dynamic = value16 ? (value20 ? value15 : "none") : "solid";
    if (!value16 && PropertiesInheritedFieldValueAlias_2(value2))
      return (
        <jsxPropertiesAppearanceSection.Fragment>
          {renderRows([
            value5,
            value7,
            value6,
            ...value9.filter(PropertiesInheritedFieldValueAlias_2),
          ])}
        </jsxPropertiesAppearanceSection.Fragment>
      );
    let value22: Dynamic = PropertiesInheritedFieldValueAlias_2(value5),
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        if (input === "none") {
          if (
            !value22 &&
            !value20 &&
            !(
              hasInline &&
              runtime.TypographyCensusBorderBorderWidthBorderStyleValues.some(
                (input2?: Dynamic): Dynamic => hasInline(input2),
              )
            )
          )
            return;
          let value32: Dynamic = hasInline
              ? [
                  "border",
                  "border-style",
                  "border-top",
                  "border-right",
                  "border-bottom",
                  "border-left",
                  "border-top-style",
                  "border-right-style",
                  "border-bottom-style",
                  "border-left-style",
                ].some((input2?: Dynamic): Dynamic => hasInline(input2))
              : value22,
            value33: Dynamic =
              !!classHasBorder ||
              !!uaBorder ||
              !!value2?.inheritedFrom ||
              (value20 && !value32);
          onCommitMany(
            value33
              ? [
                  ...PropertiesAppearanceSectionMapValue,
                  {
                    prop: "border-style",
                    value: "none",
                  },
                  ...(value5.alsoCommit ?? []),
                ]
              : PropertiesAppearanceSectionMapValue,
          );
          return;
        }
        let items3: Dynamic = [
            {
              prop: "border-style",
              value: input,
            },
          ],
          value30: Dynamic = value4.map(
            (input2?: Dynamic): Dynamic =>
              PropertiesInheritedFieldValueAlias_2(input2),
          ),
          value31: Dynamic =
            !value6.mixed &&
            !value9.some((input2?: Dynamic): Dynamic => input2.mixed);
        value20 ||
          (value31 &&
            (!value17 || value17.value === 0) &&
            (value30.some(Boolean)
              ? value30.forEach(
                  (input2?: Dynamic, options?: Dynamic): Dynamic => {
                    input2 ||
                      items3.push({
                        prop: PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues[
                          options
                        ],
                        value: "1px",
                      });
                  },
                )
              : items3.push({
                  prop: "border-width",
                  value: "1px",
                })),
          !value7.mixed &&
            !(value7.value ?? "").trim() &&
            items3.push({
              prop: "border-color",
              value: "#141413",
            }));
        onCommitMany([...items3, ...(value5.alsoCommit ?? [])]);
      },
      value23: Dynamic = null,
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        let value30: Dynamic = (input ?? "").trim();
        if (!value30) return;
        let value31: Dynamic = (0, runtime.parseCssNumber)(value30);
        if (!value31) return "bad";
        let value32: Dynamic = value31.unit || "px";
        return value23 != null && value23 !== value32
          ? "bad"
          : ((value23 = value32), value31.value);
      },
      value24: Dynamic = value6.mixed ? undefined : callback3(value6.value),
      items: Dynamic = [undefined, undefined, undefined, undefined],
      value25: Dynamic = value24 === "bad";
    for (let index: Dynamic = 0; index < 4 && !value25; index++) {
      let value30: Dynamic = value9[index].mixed
        ? undefined
        : callback3(value9[index].value);
      value30 === "bad"
        ? (value25 = true)
        : (items[index] =
            value30 !== undefined
              ? value30
              : value24 === "bad"
                ? undefined
                : value24);
    }
    let value26: Dynamic = value23 ?? "px",
      items2: Dynamic = [
        PropertiesAppearanceSectionFallback(value9[0], value26),
        PropertiesAppearanceSectionFallback(value9[1], value26),
        PropertiesAppearanceSectionFallback(value9[2], value26),
        PropertiesAppearanceSectionFallback(value9[3], value26),
      ],
      value27: Dynamic =
        PropertiesInheritedFieldMixedAlias_2(value6) ||
        value9.some(PropertiesInheritedFieldMixedAlias_2),
      callback4: Dynamic = (items3?: Dynamic): Dynamic =>
        items3.length === 4 &&
        items3.every(
          (input?: Dynamic): Dynamic => input.value === items3[0].value,
        ),
      value28: Dynamic =
        !!value6.mixed ||
        value9.some((input?: Dynamic): Dynamic => input.mixed),
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        let value30: Dynamic = items.map(
          (input2?: Dynamic, options?: Dynamic): Dynamic =>
            input2 ??
            (/^-?[\d.]+$/.test(items2[options] ?? "")
              ? (0, runtime.parseCssNumber)(items2[options] ?? "")?.value
              : undefined),
        );
        for (let value31 of input as Dynamic)
          value30[value31.side] = value31.value ?? 0;
        return value30;
      },
      callback6: Dynamic = (input?: Dynamic): Dynamic =>
        callback4(input)
          ? (input[0].value ?? 0) === 0
          : !value28 &&
            callback5(input).every((input2?: Dynamic): Dynamic => input2 === 0),
      value29: Dynamic =
        (0, runtime.getFineUnitStep)(value26, undefined) != null ? 0.1 : 1,
      callback7: Dynamic = (input?: Dynamic): Dynamic => {
        let value30: Dynamic = callback5([])[input];
        return value30 !== undefined && value30 > 0 && value30 < value29
          ? value30
          : value29;
      },
      callback8: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context: Dynamic = false,
      ): Dynamic => {
        let value30: Dynamic = callback6(input);
        if (value30 && !context) return callback2("none");
        if (callback4(input)) {
          options([
            {
              prop: "border-width",
              value: (0, runtime.formatCssNumber)(
                value30 ? callback7(0) : input[0].value,
                value26,
              ),
            },
            ...PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues.map(
              (input2?: Dynamic): Dynamic => ({
                prop: input2,
                value: null,
              }),
            ),
            ...(value6.alsoCommit ?? []),
          ]);
          return;
        }
        if (value28) {
          options([
            ...input.map(
              (input2?: Dynamic): Dynamic => ({
                prop: PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues[
                  input2.side
                ],
                value: (0, runtime.formatCssNumber)(input2.value ?? 0, value26),
              }),
            ),
            ...(value6.alsoCommit ?? []),
          ]);
          return;
        }
        let value31: Dynamic = callback5(input);
        if (value30)
          for (let value32 of input as Dynamic)
            value31[value32.side] = callback7(value32.side);
        options([
          {
            prop: "border-width",
            value: null,
          },
          ...PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues.map(
            (input2?: Dynamic, options2?: Dynamic): Dynamic => ({
              prop: input2,
              value:
                value31[options2] === undefined
                  ? null
                  : (0, runtime.formatCssNumber)(value31[options2], value26),
            }),
          ),
          ...(value6.alsoCommit ?? []),
        ]);
      };
    return (
      <jsxPropertiesAppearanceSection.Fragment>
        <runtime.PropertySegmentsRow
          label={"Border"}
          data-testid={"dc-border-style"}
          options={PropertiesAppearanceSectionItems}
          value={
            value5.mixed
              ? undefined
              : value22 || value21 === "none"
                ? value21
                : undefined
          }
          inherited={value22 || value21 === "none" ? undefined : value21}
          mixed={!!value5.mixed}
          disabled={value5.disabled}
          title={value10 ?? (value22 || value20 ? undefined : "No border")}
          description={value11}
          onChange={callback2}
          onReset={
            PropertiesInheritedFieldMixedAlias_2(value5)
              ? (): Dynamic => onCommitMany(PropertiesAppearanceSectionMapValue)
              : undefined
          }
        />
        {value21 !== "none" && !value5.mixed ? (
          <jsxPropertiesAppearanceSection.Fragment>
            {renderRow({
              ...value7,
              label: "Color",
            })}
            {value25 ? (
              renderRows([
                {
                  ...value6,
                  label: "Width",
                },
                ...value9.filter(PropertiesInheritedFieldValueAlias_2),
              ])
            ) : (
              <runtime.PropertySidesRow
                label={"Width"}
                data-testid={"dc-border-width"}
                title={value12}
                description={value13}
                values={items}
                placeholders={items2}
                unit={value26}
                min={0}
                step={value29 === 1 ? undefined : value29}
                smallStep={value29 === 1 ? undefined : 0.01}
                mixed={
                  !!value6.mixed ||
                  value9.some((input?: Dynamic): Dynamic => input.mixed)
                }
                disabled={value6.disabled}
                onSides={(input?: Dynamic): Dynamic =>
                  callback8(input, onCommitMany)
                }
                onScrubSides={(input?: Dynamic): Dynamic =>
                  callback8(input, value.onScrub, true)
                }
                onScrubEnd={(items3?: Dynamic): Dynamic =>
                  value.onScrubEnd((): Dynamic => {
                    items3.length > 0 && callback6(items3) && callback2("none");
                  })
                }
                onReset={
                  value27
                    ? (): Dynamic =>
                        onCommitMany([
                          {
                            prop: "border-width",
                            value: null,
                          },
                          ...PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues.map(
                            (input?: Dynamic): Dynamic => ({
                              prop: input,
                              value: null,
                            }),
                          ),
                        ])
                    : undefined
                }
              />
            )}
          </jsxPropertiesAppearanceSection.Fragment>
        ) : (
          renderRows(
            [value7, value6, ...value9]
              .filter(
                (input?: Dynamic): Dynamic =>
                  PropertiesInheritedFieldValueAlias_2(input) &&
                  !input.inheritedFrom,
              )
              .map(
                (input?: Dynamic): Dynamic =>
                  input === value7
                    ? {
                        ...input,
                        label: "Border color",
                      }
                    : input,
              ),
          )
        )}
      </jsxPropertiesAppearanceSection.Fragment>
    );
  }
  function useVisibleInspectorProperties(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        isLongTailPropertyVisible(input2, input.forceShown),
      callback2: Dynamic = (input2?: Dynamic): Dynamic => {
        setTimeout((): Dynamic => {
          let element: Dynamic = (document as Dynamic).querySelector(
              `[data-testid="dc-prop-${input2}"]`,
            ),
            value: Dynamic = element?.querySelector("input");
          value
            ? value.focus()
            : element?.querySelector("button[aria-haspopup]")?.click();
        }, 60);
      },
      callback3: Dynamic = (input2?: Dynamic): Dynamic => {
        input.setForceShown(
          (input3?: Dynamic): Dynamic => new Set(input3).add(input2.prop),
        );
        callback2(input2.prop);
      },
      callback4: Dynamic = (
        input2?: Dynamic,
        options: Dynamic = false,
      ): Dynamic =>
        filterLongTailProperties(input2, input.forceShown, options).map(
          (input3?: Dynamic): Dynamic => ({
            label: input3.label.replace(
              /^./,
              (input4?: Dynamic): Dynamic => input4.toUpperCase(),
            ),
            disabled: input3.disabled,
            disabledReason: input3.whyDisabled,
            onSelect: (): Dynamic => callback3(input3),
          }),
        ),
      callback5: Dynamic = (input2?: Dynamic): Dynamic =>
        input2.spec?.longTail
          ? (): Dynamic =>
              input.setForceShown((input3?: Dynamic): Dynamic => {
                let values: Dynamic = new Set(input3);
                values.delete(input2.prop);
                return values;
              })
          : undefined,
      callback6: Dynamic = (
        input2?: Dynamic,
        options: Dynamic = {},
      ): Dynamic =>
        callback(input2)
          ? (() => {
              const _Component = runtime.PropertyInspectorField;
              const _props = {
                state: input2,
                onCommit: options.onCommit ?? input.onCommit,
                onCommitMany: options.onCommitMany ?? input.onCommitMany,
                onPickImageFile: input.onPickImageFile,
                pageFonts: input.pageFonts,
                pageWebfonts: input.pageWebfonts,
                onFacesOpen: input.onFacesOpen,
                onRemoveRow: callback5(input2),
                trailing: options.trailing,
                extraMenuItems: options.extraMenuItems,
              } as const;
              const _key = `${input.selKey}|${input2.prop}`;
              return <_Component key={_key} {..._props} />;
            })()
          : null;
    return {
      isShown: callback,
      revealRow: callback3,
      addItemsFor: callback4,
      renderRow: callback6,
      renderRows: (
        input2?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        let value: Dynamic = input2.filter(callback);
        return value.length === 0 && !options ? null : (
          <jsxPropertiesAppearanceSection_2.Fragment>
            {value.map(
              (input3?: Dynamic): Dynamic =>
                callback6(input3, {
                  extraMenuItems: context,
                }),
            )}
            {options}
          </jsxPropertiesAppearanceSection_2.Fragment>
        );
      },
    };
  }
  function InspectorAppearanceSection({
    sec: sec,
    selKey: selKey,
    isNested: isNested,
    readOnly: readOnly,
    rows: rows,
    onCommitMany: onCommitMany,
    fillInline: fillInline,
    hasInline: hasInline,
    uaBorder: uaBorder,
    classHasBorder: classHasBorder,
  }: Dynamic): Dynamic {
    let {
        isShown: value,
        addItemsFor: value2,
        renderRow: value3,
        renderRows: value4,
      }: Dynamic = rows,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input.spec?.section === "border" ||
        input.spec?.section === "borderSides",
      value5: Dynamic = sec.rows.filter(callback),
      value6: Dynamic = sec.rows.filter(
        (input?: Dynamic): Dynamic => !callback(input),
      ),
      value7: Dynamic = value2(value6),
      values: Dynamic = new Set([
        "border-radius",
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius",
      ]),
      value8: Dynamic = value6.find(
        (input?: Dynamic): Dynamic => input.prop === "border-radius",
      ),
      value9: Dynamic = value6.filter(
        (input?: Dynamic): Dynamic => input.spec?.section === "radius",
      ),
      items: Dynamic = [],
      items2: Dynamic = [],
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        items2.length &&
          items.push(
            <runtime.reactPropertiesLayoutSection.default.Fragment key={input}>
              {value4(items2)}
            </runtime.reactPropertiesLayoutSection.default.Fragment>,
          );
        items2 = [];
      };
    for (let value10 of value6 as Dynamic) {
      if (value10.prop === "background") {
        callback2("pre-fill");
        let value11: Dynamic =
          fillInline &&
          ((value10.value != null && value10.value !== "") ||
            (value10.companionValue != null && value10.companionValue !== "") ||
            !!value10.mixed ||
            !!value10.companionMixed);
        items.push(
          <runtime.reactPropertiesLayoutSection.default.Fragment key={"fill"}>
            {value3(value10, {
              onCommitMany: onCommitMany,
              trailing:
                value11 && !value10.disabled ? (
                  <runtime.RemovePropertyButton
                    label={"fill"}
                    onClick={(): Dynamic =>
                      onCommitMany([
                        {
                          prop: "background",
                          value: null,
                        },
                        {
                          prop: "background-color",
                          value: null,
                        },
                      ])
                    }
                  />
                ) : undefined,
            })}
          </runtime.reactPropertiesLayoutSection.default.Fragment>,
        );
        continue;
      }
      if (value10.prop === "border-radius" && value8 && value(value8)) {
        callback2("pre-radius");
        items.push(
          <PropertyCornerRadius
            key={`${selKey}|radius`}
            radius={value8}
            corners={value9}
            renderRows={value4}
            onCommitMany={onCommitMany}
          />,
        );
        continue;
      }
      (values.has(value10.prop) &&
        value10.prop !== "border-radius" &&
        value8 &&
        value(value8)) ||
        items2.push(value10);
    }
    callback2("rest");
    return (
      <runtime.PropertySection
        title={sec.title}
        iconColumn={true}
        actions={
          isNested || value7.length === 0 ? undefined : (
            <runtime.PropertyActions
              section={sec.title}
              data-testid={`dc-add-${sec.id}`}
              items={value7}
              disabled={readOnly}
            />
          )
        }
      >
        {items}
        {value5.length > 0 ? (
          <PropertyBorderSection
            key={`${selKey}|border`}
            rows={value5}
            renderRows={value4}
            renderRow={value3}
            onCommitMany={onCommitMany}
            hasInline={hasInline}
            uaBorder={uaBorder}
            classHasBorder={classHasBorder}
          />
        ) : null}
      </runtime.PropertySection>
    );
  }
  bindRuntimeValue(
    runtime,
    "isLongTailPropertyVisible",
    () => isLongTailPropertyVisible,
  );
  bindRuntimeValue(
    runtime,
    "filterLongTailProperties",
    () => filterLongTailProperties,
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesAppearanceSection",
    () => jsxPropertiesAppearanceSection,
    (value) => {
      jsxPropertiesAppearanceSection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionFallback",
    () => PropertiesAppearanceSectionFallback,
    (value) => {
      PropertiesAppearanceSectionFallback = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInheritedFieldValueAlias_2",
    () => PropertiesInheritedFieldValueAlias_2,
    (value) => {
      PropertiesInheritedFieldValueAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInheritedFieldMixedAlias_2",
    () => PropertiesInheritedFieldMixedAlias_2,
    (value) => {
      PropertiesInheritedFieldMixedAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues",
    () =>
      PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues,
    (value) => {
      PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues =
        value;
    },
  );
  bindRuntimeValue(runtime, "PropertyCornerRadius", () => PropertyCornerRadius);
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues",
    () =>
      PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues,
    (value) => {
      PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues =
        value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionItems",
    () => PropertiesAppearanceSectionItems,
    (value) => {
      PropertiesAppearanceSectionItems = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionMapValue",
    () => PropertiesAppearanceSectionMapValue,
    (value) => {
      PropertiesAppearanceSectionMapValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertyBorderSection",
    () => PropertyBorderSection,
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesAppearanceSection_2",
    () => jsxPropertiesAppearanceSection_2,
    (value) => {
      jsxPropertiesAppearanceSection_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useVisibleInspectorProperties",
    () => useVisibleInspectorProperties,
  );
  bindRuntimeValue(
    runtime,
    "InspectorAppearanceSection",
    () => InspectorAppearanceSection,
  );
  bindRuntimeValue(
    runtime,
    "jsxPropertiesAppearanceSection_3",
    () => jsxPropertiesAppearanceSection_3,
    (value) => {
      jsxPropertiesAppearanceSection_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionSubscribers",
    () => PropertiesAppearanceSectionSubscribers,
    (value) => {
      PropertiesAppearanceSectionSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionSubscribers_2",
    () => PropertiesAppearanceSectionSubscribers_2,
    (value) => {
      PropertiesAppearanceSectionSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionLabel",
    () => PropertiesAppearanceSectionLabel,
    (value) => {
      PropertiesAppearanceSectionLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionLabel_2",
    () => PropertiesAppearanceSectionLabel_2,
    (value) => {
      PropertiesAppearanceSectionLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ACanvasPictureShowsAnUploadedMessage",
    () => ACanvasPictureShowsAnUploadedMessage,
    (value) => {
      ACanvasPictureShowsAnUploadedMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionLabel_3",
    () => PropertiesAppearanceSectionLabel_3,
    (value) => {
      PropertiesAppearanceSectionLabel_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionLabel_4",
    () => PropertiesAppearanceSectionLabel_4,
    (value) => {
      PropertiesAppearanceSectionLabel_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionLabel_5",
    () => PropertiesAppearanceSectionLabel_5,
    (value) => {
      PropertiesAppearanceSectionLabel_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionItems_2",
    () => PropertiesAppearanceSectionItems_2,
    (value) => {
      PropertiesAppearanceSectionItems_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionLabel_6",
    () => PropertiesAppearanceSectionLabel_6,
    (value) => {
      PropertiesAppearanceSectionLabel_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionLabel_7",
    () => PropertiesAppearanceSectionLabel_7,
    (value) => {
      PropertiesAppearanceSectionLabel_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionImageVideoRectConfig",
    () => PropertiesAppearanceSectionImageVideoRectConfig,
    (value) => {
      PropertiesAppearanceSectionImageVideoRectConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionWidthHeightPositionSet",
    () => PropertiesAppearanceSectionWidthHeightPositionSet,
    (value) => {
      PropertiesAppearanceSectionWidthHeightPositionSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionNoteTitle1Config",
    () => PropertiesAppearanceSectionNoteTitle1Config,
    (value) => {
      PropertiesAppearanceSectionNoteTitle1Config = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionSubscribers_3",
    () => PropertiesAppearanceSectionSubscribers_3,
    (value) => {
      PropertiesAppearanceSectionSubscribers_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionBoxShadowFilterBackdropFilterSet",
    () => PropertiesAppearanceSectionBoxShadowFilterBackdropFilterSet,
    (value) => {
      PropertiesAppearanceSectionBoxShadowFilterBackdropFilterSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionFontSizeFontWeightSet",
    () => PropertiesAppearanceSectionFontSizeFontWeightSet,
    (value) => {
      PropertiesAppearanceSectionFontSizeFontWeightSet = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionHandler",
    () => PropertiesAppearanceSectionHandler,
    (value) => {
      PropertiesAppearanceSectionHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesAppearanceSectionImageRectOvalConfig",
    () => PropertiesAppearanceSectionImageRectOvalConfig,
    (value) => {
      PropertiesAppearanceSectionImageRectOvalConfig = value;
    },
  );
  return () => {
    jsxPropertiesAppearanceSection = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesAppearanceSectionFallback = (
      input?: Dynamic,
      options: Dynamic = "px",
    ): Dynamic => {
      let value: Dynamic = (0, runtime.parseCssNumber)(input.fallback ?? "");
      if (!value) return input.fallback ?? "";
      let value2: Dynamic = value.unit || "px";
      return (0, runtime.formatCssNumber)(
        (0, runtime.roundCssNumber)(value.value, value.unit),
        value2 === options ? "" : value2,
      );
    };
    PropertiesInheritedFieldValueAlias_2 =
      runtime.PropertiesInheritedFieldValue;
    PropertiesInheritedFieldMixedAlias_2 =
      runtime.PropertiesInheritedFieldMixed;
    PropertiesAppearanceSectionBorderTopLeftRadiusBorderTopRightRadiusBorderBottomRightRadiusValues =
      [
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius",
      ];
    PropertiesAppearanceSectionBorderTopWidthBorderRightWidthBorderBottomWidthValues =
      [
        "border-top-width",
        "border-right-width",
        "border-bottom-width",
        "border-left-width",
      ];
    PropertiesAppearanceSectionItems = [
      {
        value: "none",
        label: "None",
        icon: "Prohibit",
      },
      {
        value: "solid",
        label: "Solid",
        glyph: runtime.PropertiesTooltipNameViewBoxPathsConfig_6,
      },
      {
        value: "dashed",
        label: "Dashed",
        glyph: runtime.PropertiesTooltipNameViewBoxPathsConfig_7,
      },
      {
        value: "dotted",
        label: "Dotted",
        glyph: runtime.PropertiesTooltipNameViewBoxPathsConfig_8,
      },
    ];
    PropertiesAppearanceSectionMapValue =
      runtime.TypographyCensusBorderBorderWidthBorderStyleValues.map(
        (input?: Dynamic): Dynamic => ({
          prop: input,
          value: null,
        }),
      );
    jsxPropertiesAppearanceSection_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    jsxPropertiesAppearanceSection_3 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesAppearanceSectionSubscribers = new Set();
    PropertiesAppearanceSectionSubscribers_2 = new Set(
      runtime.PlatformFileContentBackgroundBackgroundColorOpacityValues,
    );
    PropertiesAppearanceSectionLabel =
      "Canvas objects are placed freely on the canvas";
    PropertiesAppearanceSectionLabel_2 =
      "A canvas object has a fixed size \u2014 there is no parent to hug or fill";
    ACanvasPictureShowsAnUploadedMessage =
      "A canvas picture shows an uploaded file or a project image, not an outside address";
    PropertiesAppearanceSectionLabel_3 =
      "A note is as tall as its text, up to its max height";
    PropertiesAppearanceSectionLabel_4 =
      "A title is as wide and tall as its text, up to its max width and height";
    PropertiesAppearanceSectionLabel_5 = "An oval is always round";
    PropertiesAppearanceSectionItems_2 = [
      {
        weight: 400,
        italic: false,
      },
      {
        weight: 700,
        italic: false,
      },
      {
        weight: 400,
        italic: true,
      },
      {
        weight: 700,
        italic: true,
      },
    ];
    PropertiesAppearanceSectionLabel_6 =
      "A canvas object paints a colour or gradient \u2014 place a picture for an image";
    PropertiesAppearanceSectionLabel_7 =
      "Replace it from the strip above the video on the canvas.";
    PropertiesAppearanceSectionImageVideoRectConfig = {
      image: new Set(["size", "sizing", "image", "appearance", "effects"]),
      video: new Set(["size", "sizing", "media", "appearance", "effects"]),
      rect: new Set(["size", "sizing", "appearance", "effects"]),
      oval: new Set(["size", "sizing", "appearance", "effects"]),
      line: new Set(["size", "sizing", "svgPaint", "appearance", "effects"]),
      arrow: new Set(["size", "sizing", "svgPaint", "appearance", "effects"]),
      pen: new Set(["size", "sizing", "svgPaint", "appearance", "effects"]),
      note: new Set(["size", "sizing", "text"]),
      title1: new Set(["size", "sizing", "text"]),
    };
    PropertiesAppearanceSectionWidthHeightPositionSet = new Set([
      "width",
      "height",
      "position",
      "top",
      "left",
    ]);
    PropertiesAppearanceSectionNoteTitle1Config = {
      note: new Set(["max-height"]),
      title1: new Set(["max-width", "max-height"]),
    };
    PropertiesAppearanceSectionSubscribers_3 = new Set([
      "@src",
      "object-fit",
      "object-position",
    ]);
    PropertiesAppearanceSectionBoxShadowFilterBackdropFilterSet = new Set([
      "box-shadow",
      "filter",
      "backdrop-filter",
    ]);
    PropertiesAppearanceSectionFontSizeFontWeightSet = new Set([
      "font-size",
      "font-weight",
    ]);
    PropertiesAppearanceSectionHandler = (input?: Dynamic): Dynamic =>
      input === undefined ? "none" : String(input) + "px";
    PropertiesAppearanceSectionImageRectOvalConfig = {
      image: "img",
      rect: "div",
      oval: "div",
      line: "svg",
      arrow: "svg",
      pen: "svg",
      note: "p",
      title1: "h1",
    };
  };
}
