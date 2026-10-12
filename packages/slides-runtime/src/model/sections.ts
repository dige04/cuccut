/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type { DeckSection, SlideId } from "../deck-contracts";

/** Untrusted JSON-like record read field by field before it is validated. */
type RawRecord = Record<string, unknown>;
/** The slice of a deck document the section operations read and rewrite. */
export interface SectionedDeck {
  order: SlideId[];
  sections?: DeckSection[];
}
/** A deck whose `sections` list has been made present. */
export type WithSections<D extends SectionedDeck> = D & {
  sections: DeckSection[];
};
/** A section anchored on its first slide (`start` is set). */
export type AnchoredSection = DeckSection & { start: SlideId };
/** One run of slides in deck order, headed by a section (or by none), or an empty section with no slides. */
export interface SectionGroup {
  section: DeckSection | null;
  ids: SlideId[];
}
/** A section group that is headed by a section. */
type HeadedSectionGroup = SectionGroup & { section: DeckSection };
/** The title/description pair carried by every section. */
export type SectionDescriptionFields = Pick<
  DeckSection,
  "title" | "description"
>;
/** The section fields tracked by section diffs. */
export type SectionDiffField = "description" | "start" | "before" | "seq";
/** Section field values captured by a diff (`null` marks a field that is absent). */
export type SectionFieldValues = Partial<
  Record<SectionDiffField, string | number | null>
>;
/** A section present on both sides of a diff whose tracked fields differ. */
export interface SectionChange {
  id: string;
  from: SectionFieldValues;
  to: SectionFieldValues;
  was: DeckSection;
  now: DeckSection;
}
/** Difference between the sections (and slide order) of two decks. */
export interface SectionsDiff {
  added: DeckSection[];
  removed: DeckSection[];
  changed: SectionChange[];
  order?: { from: SlideId[]; to: SlideId[] };
}
/** Where dropped slides land: into a new section at a gap, or into an existing section at an index. */
export type SectionInsertTarget =
  | { gapIndex: number }
  | { sectionId: string | null; index: number };

declare module "../bindings" {
  interface RuntimeBindings {
    sectionIdPattern: RegExp;
    isEmptySection: (section: DeckSection) => boolean;
    sectionHasDescription: (section: DeckSection) => boolean;
    sectionDescriptionFields: (
      section: DeckSection,
    ) => SectionDescriptionFields;
    normalizeSectionDescription: (input: unknown, maxLength: number) => string;
    emptySectionHasNoDescription: (section: DeckSection) => boolean;
    sectionDiffFields: readonly SectionDiffField[];
    initializeSections: () => void;
    normalizeSections: (sections: unknown) => DeckSection[] | undefined;
    anchoredSectionsInOrder: (
      sections: DeckSection[] | undefined,
      slideOrder: SlideId[],
    ) => AnchoredSection[];
    sectionGroups: (
      sections: DeckSection[] | undefined,
      slideOrder: SlideId[],
    ) => SectionGroup[];
    reconcileSectionsWithSlideOrder: (
      sections: DeckSection[] | undefined,
      slideOrder: SlideId[],
    ) => DeckSection[] | undefined;
    normalizeEmptySectionDescriptions: <D extends SectionedDeck>(
      deck: D,
      preferredSectionIds?: string[],
    ) => D;
    removeSlideFromSections: (
      sections: DeckSection[] | undefined,
      slideOrder: SlideId[],
      slideId: SlideId,
    ) => DeckSection[] | undefined;
    preserveEmptySectionOrder: (
      sections: DeckSection[],
      previousSections: DeckSection[],
      previousOrder: SlideId[],
      slideOrder: SlideId[],
    ) => DeckSection[];
    sectionsEqual: (
      sections: DeckSection[] | undefined,
      otherSections: DeckSection[] | undefined,
    ) => boolean;
    firstSlideAfterSectionGroup: (
      groups: SectionGroup[],
      groupIndex: number,
    ) => SlideId | null;
    precedingEmptySectionIds: (
      groups: SectionGroup[],
      groupIndex: number,
    ) => string[];
    emptySectionRunIds: (
      sections: DeckSection[],
      groups: SectionGroup[],
      groupIndex: number,
      sectionId: string,
    ) => DeckSection[];
    addSectionAtSlide: <D extends SectionedDeck>(
      deck: D,
      slideId: SlideId,
      description?: string,
      sectionId?: string,
    ) => WithSections<D> | undefined;
    addEmptySectionBeforeSlide: <D extends SectionedDeck>(
      deck: D,
      beforeSlideId: SlideId | null,
      sectionId?: string,
    ) => WithSections<D> | undefined;
    addSectionAtGap: <D extends SectionedDeck>(
      deck: D,
      gapIndex: number,
      sectionId?: string,
    ) => WithSections<D> | undefined;
    appendEmptySection: <D extends SectionedDeck>(
      deck: D,
      sectionId?: string,
    ) => WithSections<D> | undefined;
    moveSlidesIntoNewSection: <D extends SectionedDeck>(
      deck: D,
      selectedSlideIds: SlideId[],
      gapIndex: number,
      sectionId?: string,
      splitSectionId?: string,
    ) => D | undefined;
    createSectionFromSlides: <D extends SectionedDeck>(
      deck: D,
      selectedSlideIds: SlideId[],
      sectionId?: string,
    ) => D | undefined;
    detachSlidesForSectionMove: (
      deck: SectionedDeck,
      sections: DeckSection[] | undefined,
      slideIds: SlideId[],
      beforeSlideId: SlideId | null,
    ) => { order: SlideId[]; sections: DeckSection[] };
    moveSlidesToSection: <D extends SectionedDeck>(
      deck: D,
      selectedSlideIds: SlideId[],
      sectionId: string | null,
      beforeSlideId: number,
    ) => D | undefined;
    insertSlidesAtSectionTarget: <D extends SectionedDeck>(
      deck: D,
      slideIds: SlideId[],
      target: SectionInsertTarget,
      sectionId?: string,
      splitSectionId?: string,
    ) => D | undefined;
    deckSectionLayoutsEqual: (
      deck: SectionedDeck,
      otherDeck: SectionedDeck,
    ) => boolean;
    deleteSection: <D extends SectionedDeck>(
      deck: D,
      sectionId: string,
    ) => D | undefined;
    renameSection: <D extends SectionedDeck>(
      deck: D,
      sectionId: string,
      description: string,
    ) => D | undefined;
    moveSectionToGap: <D extends SectionedDeck>(
      deck: D,
      sectionId: string,
      gapIndex: number,
    ) => D | undefined;
    moveSectionsToGap: <D extends SectionedDeck>(
      deck: D,
      sectionIds: string[],
      gapIndex: number,
    ) => D | undefined;
    diffSections: (
      previousDeck: SectionedDeck,
      deck: SectionedDeck,
    ) => SectionsDiff;
    invertSectionsDiff: (diff: SectionsDiff) => SectionsDiff;
    applySectionFields: (
      section: DeckSection,
      patch: SectionFieldValues,
    ) => DeckSection;
    applySectionsDiff: <D extends SectionedDeck>(
      deck: D,
      diff: SectionsDiff,
    ) => D;
  }
}

export function installModelSections(runtime: RuntimeBindings): () => void {
  var sectionIdPattern: RuntimeBindings["sectionIdPattern"];
  var isEmptySection: RuntimeBindings["isEmptySection"];
  var sectionHasDescription: RuntimeBindings["sectionHasDescription"];
  var sectionDescriptionFields: RuntimeBindings["sectionDescriptionFields"];
  var normalizeSectionDescription: RuntimeBindings["normalizeSectionDescription"];
  var emptySectionHasNoDescription: RuntimeBindings["emptySectionHasNoDescription"];
  var sectionDiffFields: RuntimeBindings["sectionDiffFields"];
  var initializeSections: RuntimeBindings["initializeSections"];
  function normalizeSections(sections: unknown): DeckSection[] | undefined {
    if (typeof sections !== "object" || sections === null) {
      return;
    }
    let entries: [unknown, unknown][] = Array.isArray(sections)
        ? sections
            .slice(0, 4 * runtime.maxDeckSections)
            .map((input: unknown): [unknown, unknown] => [
              typeof input === "object" && input !== null
                ? (input as RawRecord).id
                : undefined,
              input,
            ])
        : Object.entries<unknown>(sections as RawRecord),
      sections2: DeckSection[] = [],
      seenIds: Set<string> = new Set();
    for (let [value, value2] of entries) {
      if (sections2.length >= runtime.maxDeckSections) {
        break;
      }
      if (
        typeof value2 !== "object" ||
        value2 === null ||
        Array.isArray(value2) ||
        typeof value !== "string" ||
        !sectionIdPattern.test(value) ||
        /^__.*__$/.test(value) ||
        seenIds.has(value)
      ) {
        continue;
      }
      seenIds.add(value);
      let value3: RawRecord = value2 as RawRecord,
        value4: string = normalizeSectionDescription(
          value3.title,
          runtime.maxSectionDescriptionLength,
        ),
        state: DeckSection = {
          id: value,
          ...(value4 !== ""
            ? {
                title: value4,
              }
            : {}),
          description:
            normalizeSectionDescription(
              value3.description,
              runtime.maxSectionDescriptionLength,
            ) || value4,
        };
      if (value3.start !== undefined && value3.start !== null) {
        if (
          typeof value3.start === "string" &&
          sectionIdPattern.test(value3.start)
        ) {
          sections2.push({
            ...state,
            start: value3.start,
          });
        }
        continue;
      }
      if (
        value3.before !== null &&
        value3.before !== undefined &&
        typeof value3.before !== "string"
      ) {
        continue;
      }
      let value5: { seq?: number } =
        typeof value3.seq === "number" && Number.isFinite(value3.seq)
          ? {
              seq: value3.seq,
            }
          : {};
      sections2.push({
        ...state,
        before:
          typeof value3.before === "string" &&
          sectionIdPattern.test(value3.before)
            ? value3.before
            : null,
        ...value5,
      });
    }
    return sections2;
  }
  function anchoredSectionsInOrder(
    sections: DeckSection[] | undefined,
    slideOrder: SlideId[],
  ): AnchoredSection[] {
    if (sections === undefined) {
      return [];
    }
    let orderIndices: Map<SlideId, number> = new Map(
        slideOrder.map((input, options): [SlideId, number] => [input, options]),
      ),
      seenStarts: Set<SlideId> = new Set();
    return sections
      .filter(
        (input): input is AnchoredSection =>
          input.start !== undefined &&
          orderIndices.has(input.start) &&
          !seenStarts.has(input.start) &&
          (seenStarts.add(input.start), true),
      )
      .sort(
        (input, options) =>
          orderIndices.get(input.start)! - orderIndices.get(options.start)!,
      );
  }
  function sectionGroups(
    sections: DeckSection[] | undefined,
    slideOrder: SlideId[],
  ): SectionGroup[] {
    let anchoredSections: AnchoredSection[] = anchoredSectionsInOrder(
        sections,
        slideOrder,
      ),
      sectionsByStart: Map<SlideId, AnchoredSection> = new Map(
        anchoredSections.map((input): [SlideId, AnchoredSection] => [
          input.start,
          input,
        ]),
      ),
      groups: SectionGroup[] = [];
    for (let value3 of slideOrder) {
      let entry: AnchoredSection | undefined = sectionsByStart.get(value3);
      if (entry !== undefined || groups.length === 0) {
        groups.push({
          section: entry ?? null,
          ids: [],
        });
      }
      groups[groups.length - 1]!.ids.push(value3);
    }
    if (
      groups[0] !== undefined &&
      groups[0].section === null &&
      groups[0].ids.length === 0
    ) {
      groups.shift();
    }
    let entries: Map<SlideId, number> = new Map();
    groups.forEach((input, options) =>
      input.ids.forEach((input2) => entries.set(input2, options)),
    );
    let value: DeckSection[] = (sections ?? []).filter(isEmptySection),
      callback = (input: DeckSection): number =>
        typeof input.before === "string" && entries.has(input.before)
          ? entries.get(input.before)!
          : groups.length,
      entries2: Map<number, DeckSection[]> = new Map();
    for (let value3 of value)
      entries2.set(callback(value3), [
        ...(entries2.get(callback(value3)) ?? []),
        value3,
      ]);
    let items: SectionGroup[] = [];
    for (let index = 0; index <= groups.length; index++) {
      for (let value3 of (entries2.get(index) ?? []).sort(
        (input, options) =>
          (input.seq ?? 0) - (options.seq ?? 0) ||
          (input.id < options.id ? -1 : 1),
      ))
        items.push({
          section: value3,
          ids: [],
        });
      if (index < groups.length) {
        items.push(groups[index]!);
      }
    }
    let value2: number = items.findIndex((input) => input.section === null);
    if (value2 > 0 && items[value2 - 1]!.ids.length === 0) {
      items.splice(value2 - 1, 2, {
        section: items[value2 - 1]!.section,
        ids: items[value2]!.ids,
      });
    }
    return items;
  }
  function reconcileSectionsWithSlideOrder(
    sections: DeckSection[] | undefined,
    slideOrder: SlideId[],
  ): DeckSection[] | undefined {
    if (sections === undefined) {
      return;
    }
    let value: DeckSection[] = sections,
      values: Set<SlideId> = new Set();
    if (
      value.some(
        (input) =>
          input.start !== undefined &&
          (values.has(input.start) || (values.add(input.start), false)),
      )
    ) {
      let values2: Set<SlideId> = new Set();
      value = value.flatMap((input): DeckSection[] => {
        if (input.start === undefined || !values2.has(input.start)) {
          if (input.start !== undefined) {
            values2.add(input.start);
          }
          return [input];
        }
        if (!sectionHasDescription(input)) {
          return [];
        } else {
          return [
            {
              id: input.id,
              ...sectionDescriptionFields(input),
              before: input.start,
              seq: input.seq ?? 0,
            },
          ];
        }
      });
    }
    let value2: HeadedSectionGroup | undefined = sectionGroups(
      value,
      slideOrder,
    ).find(
      (input): input is HeadedSectionGroup =>
        input.section !== null &&
        isEmptySection(input.section) &&
        input.ids.length > 0,
    );
    if (value2 === undefined) {
      return value;
    }
    let section: DeckSection = value2.section;
    return value.map((input) =>
      input.id === section.id
        ? {
            id: input.id,
            ...sectionDescriptionFields(input),
            start: value2.ids[0],
          }
        : input,
    );
  }
  function normalizeEmptySectionDescriptions<D extends SectionedDeck>(
    deck: D,
    preferredSectionIds: string[] = [],
  ): D {
    let sections: DeckSection[] | undefined = deck.sections;
    if (sections === undefined) {
      return deck;
    }
    let emptySectionIds: string[] = sectionGroups(
      sections,
      deck.order,
    ).flatMap((input): string[] =>
      input.section !== null &&
      input.ids.length === 0 &&
      emptySectionHasNoDescription(input.section)
        ? [input.section.id]
        : [],
    );
    if (emptySectionIds.length <= 1) {
      return deck;
    }
    let keptSectionId: string | undefined =
      preferredSectionIds.find((input) => emptySectionIds.includes(input)) ??
      emptySectionIds[0];
    return {
      ...deck,
      sections: sections.filter(
        (input) =>
          input.id === keptSectionId || !emptySectionIds.includes(input.id),
      ),
    };
  }
  function removeSlideFromSections(
    sections: DeckSection[] | undefined,
    slideOrder: SlideId[],
    slideId: SlideId,
  ): DeckSection[] | undefined {
    if (sections === undefined) {
      return;
    }
    let slideIndex: number = slideOrder.indexOf(slideId),
      nextSlideId: SlideId | undefined =
        slideIndex >= 0 ? slideOrder[slideIndex + 1] : undefined,
      replacementBeforeId: SlideId | null =
        (sectionGroups(sections, slideOrder)
          .find((input) => input.ids.includes(slideId))
          ?.ids.filter((input) => input !== slideId) ?? [])[0] ??
        nextSlideId ??
        null,
      reanchorEmptySection = (input: DeckSection): DeckSection =>
        isEmptySection(input) && input.before === slideId
          ? {
              ...input,
              before: replacementBeforeId,
            }
          : input,
      startingSection: DeckSection | undefined = sections.find(
        (input) => input.start === slideId,
      );
    if (startingSection === undefined) {
      if (sections.some((input) => input.before === slideId)) {
        return sections.map(reanchorEmptySection);
      } else {
        return sections;
      }
    }
    let sectionStarts: Set<SlideId> = new Set(
        anchoredSectionsInOrder(sections, slideOrder).map(
          (input) => input.start,
        ),
      ),
      canExtendSection: boolean =
        nextSlideId !== undefined && !sectionStarts.has(nextSlideId),
      result: DeckSection[] = [];
    for (let value of sections)
      if (value.start !== slideId) {
        result.push(reanchorEmptySection(value));
      } else if (
        !(value === startingSection && canExtendSection) &&
        !sectionHasDescription(value)
      ) {
        continue;
      } else {
        let { start: value2, ...value3 }: DeckSection = value;
        result.push(
          value === startingSection && canExtendSection
            ? {
                ...value3,
                start: nextSlideId,
              }
            : {
                ...value3,
                before: nextSlideId ?? null,
                seq: 0,
              },
        );
      }
    return preserveEmptySectionOrder(
      result,
      sections,
      slideOrder,
      slideOrder.filter((input) => input !== slideId),
    );
  }
  function preserveEmptySectionOrder(
    sections: DeckSection[],
    previousSections: DeckSection[],
    previousOrder: SlideId[],
    slideOrder: SlideId[],
  ): DeckSection[] {
    let previousGroupIndices: Map<string, number> = new Map(
        sectionGroups(previousSections, previousOrder).flatMap(
          (input, options): [string, number][] =>
            input.section !== null ? [[input.section.id, options]] : [],
        ),
      ),
      groups: SectionGroup[] = sectionGroups(sections, slideOrder),
      result: DeckSection[] = sections;
    for (let index = 0; index < groups.length; ) {
      let value: number = index;
      while (
        value < groups.length &&
        groups[value]!.section !== null &&
        groups[value]!.ids.length === 0 &&
        isEmptySection(groups[value]!.section!)
      )
        value++;
      let value2: DeckSection[] = groups
        .slice(index, value)
        .map((input) => input.section!);
      index = Math.max(value, index + 1);
      if (value2.length < 2) {
        continue;
      }
      let value3: DeckSection[] = [...value2].sort(
        (input, options) =>
          (previousGroupIndices.get(input.id) ?? 1 / 0) -
          (previousGroupIndices.get(options.id) ?? 1 / 0),
      );
      if (
        value3.every((input, options) => input.id === value2[options]!.id)
      ) {
        continue;
      }
      let value4: number[] = value2
        .map((input) => input.seq ?? 0)
        .sort((input, options) => input - options);
      for (let count = 1; count < value4.length; count++)
        if (value4[count]! <= value4[count - 1]!) {
          value4[count] = value4[count - 1]! + 1;
        }
      let entries: Map<string, number> = new Map(
        value3.map((input, options): [string, number] => [
          input.id,
          value4[options]!,
        ]),
      );
      result = result.map((input) =>
        entries.has(input.id)
          ? {
              ...input,
              seq: entries.get(input.id),
            }
          : input,
      );
    }
    return result;
  }
  function sectionsEqual(
    sections: DeckSection[] | undefined,
    otherSections: DeckSection[] | undefined,
  ): boolean {
    return (
      JSON.stringify(sections ?? null) === JSON.stringify(otherSections ?? null)
    );
  }
  function firstSlideAfterSectionGroup(
    groups: SectionGroup[],
    groupIndex: number,
  ): SlideId | null {
    for (let value = groupIndex + 1; value < groups.length; value++)
      if (groups[value]!.ids.length > 0) {
        return groups[value]!.ids[0]!;
      }
    return null;
  }
  function precedingEmptySectionIds(
    groups: SectionGroup[],
    groupIndex: number,
  ): string[] {
    let items: string[] = [];
    for (
      let value = groupIndex - 1;
      value >= 0 &&
      groups[value]!.section !== null &&
      groups[value]!.ids.length === 0;
      value--
    )
      items.push(groups[value]!.section!.id);
    return items;
  }
  function emptySectionRunIds(
    sections: DeckSection[],
    groups: SectionGroup[],
    groupIndex: number,
    sectionId: string,
  ): DeckSection[] {
    let beforeIds: string[] = precedingEmptySectionIds(
        groups,
        groupIndex,
      ).reverse(),
      afterIds: string[] = [];
    for (
      let value = groupIndex;
      value < groups.length &&
      groups[value]!.section !== null &&
      groups[value]!.ids.length === 0;
      value++
    )
      if (groups[value]!.section!.id !== sectionId) {
        afterIds.push(groups[value]!.section!.id);
      }
    if (beforeIds.length === 0 && afterIds.length === 0) {
      return sections;
    }
    let sequenceBase: number = Date.now(),
      sequencesById: Map<string, number> = new Map(
        [
          ...beforeIds.filter((input) => input !== sectionId),
          sectionId,
          ...afterIds,
        ].map((input, options): [string, number] => [
          input,
          sequenceBase + options,
        ]),
      );
    return sections.map((input) =>
      sequencesById.has(input.id) && isEmptySection(input)
        ? {
            ...input,
            seq: sequencesById.get(input.id),
          }
        : input,
    );
  }
  function addSectionAtSlide<D extends SectionedDeck>(
    deck: D,
    slideId: SlideId,
    description: string = "",
    sectionId: string = (0, runtime.createModelId)(),
  ): WithSections<D> | undefined {
    let sections: DeckSection[] =
        reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [],
      anchoredSections: AnchoredSection[] = anchoredSectionsInOrder(
        sections,
        deck.order,
      );
    if (
      !deck.order.includes(slideId) ||
      anchoredSections.some((input) => input.start === slideId) ||
      sections.some((input) => input.id === sectionId) ||
      sections.length >= runtime.maxDeckSections
    ) {
      return;
    }
    return {
      ...deck,
      sections: [
        ...sections,
        {
          id: sectionId,
          description: (0, runtime.normalizeDescription)(
            description,
            runtime.maxSectionDescriptionLength,
          ),
          start: slideId,
        },
      ],
    };
  }
  function addEmptySectionBeforeSlide<D extends SectionedDeck>(
    deck: D,
    beforeSlideId: SlideId | null,
    sectionId: string = (0, runtime.createModelId)(),
  ): WithSections<D> | undefined {
    let value: DeckSection[] =
      reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [];
    if (
      value.some((input) => input.id === sectionId) ||
      value.length >= runtime.maxDeckSections
    ) {
      return;
    }
    let value2: boolean =
      deck.order[0] !== undefined &&
      beforeSlideId === deck.order[0] &&
      !anchoredSectionsInOrder(value, deck.order).some(
        (input) => input.start === beforeSlideId,
      );
    return {
      ...deck,
      sections: [
        ...value,
        value2
          ? {
              id: sectionId,
              description: "",
              start: beforeSlideId!,
            }
          : {
              id: sectionId,
              description: "",
              before: beforeSlideId,
              seq: Date.now(),
            },
      ],
    };
  }
  function addSectionAtGap<D extends SectionedDeck>(
    deck: D,
    gapIndex: number,
    sectionId: string = (0, runtime.createModelId)(),
  ): WithSections<D> | undefined {
    deck = {
      ...deck,
      sections: reconcileSectionsWithSlideOrder(deck.sections, deck.order),
    };
    let value: SectionGroup[] = sectionGroups(deck.sections, deck.order);
    if (gapIndex < 0 || gapIndex > value.length) {
      return;
    }
    let value2: WithSections<D> | undefined = addEmptySectionBeforeSlide(
      deck,
      firstSlideAfterSectionGroup(value, gapIndex - 1),
      sectionId,
    );
    if (value2 === undefined) {
      return undefined;
    } else {
      return {
        ...value2,
        sections: emptySectionRunIds(
          value2.sections,
          value,
          gapIndex,
          sectionId,
        ),
      };
    }
  }
  function appendEmptySection<D extends SectionedDeck>(
    deck: D,
    sectionId: string = (0, runtime.createModelId)(),
  ): WithSections<D> | undefined {
    deck = {
      ...deck,
      sections: reconcileSectionsWithSlideOrder(deck.sections, deck.order),
    };
    return addSectionAtGap(
      deck,
      sectionGroups(deck.sections, deck.order).length,
      sectionId,
    );
  }
  function moveSlidesIntoNewSection<D extends SectionedDeck>(
    deck: D,
    selectedSlideIds: SlideId[],
    gapIndex: number,
    sectionId: string = (0, runtime.createModelId)(),
    splitSectionId: string = (0, runtime.createModelId)(),
  ): D | undefined {
    let values: Set<SlideId> = new Set(selectedSlideIds),
      value: SlideId[] = deck.order.filter((input) => values.has(input)),
      value2: DeckSection[] =
        reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [];
    if (
      value.length === 0 ||
      value.length !== values.size ||
      value2.some((input) => input.id === sectionId) ||
      value2.length >= runtime.maxDeckSections
    ) {
      return;
    }
    let value3: SectionGroup[] = sectionGroups(value2, deck.order);
    if (gapIndex < 0 || gapIndex > value3.length) {
      return;
    }
    let value4: SlideId | null = firstSlideAfterSectionGroup(
      value3,
      gapIndex - 1,
    );
    while (value4 !== null && values.has(value4))
      value4 = deck.order[deck.order.indexOf(value4) + 1] ?? null;
    let value5: DeckSection[] = value2,
      value6: SlideId | undefined =
        gapIndex === 0 && value3[0] !== undefined && value3[0].section === null
          ? value3[0].ids.find((input) => !values.has(input))
          : undefined;
    if (value6 !== undefined) {
      if (
        value2.length + 1 >= runtime.maxDeckSections ||
        value2.some((input) => input.id === splitSectionId)
      ) {
        return;
      }
      value5 = [
        ...value2,
        {
          id: splitSectionId,
          description: "",
          start: value6,
        },
      ];
    }
    let { order: value7, sections: value8 } = detachSlidesForSectionMove(
        deck,
        value5,
        value,
        value4,
      ),
      values2: Set<string> = new Set(precedingEmptySectionIds(value3, gapIndex)),
      items: DeckSection[] = [
        ...value8.map((input) =>
          values2.has(input.id)
            ? {
                ...input,
                before: value[0],
              }
            : input,
        ),
        {
          id: sectionId,
          description: "",
          start: value[0],
        },
      ];
    return {
      ...deck,
      order: value7,
      sections: reconcileSectionsWithSlideOrder(items, value7),
    };
  }
  function createSectionFromSlides<D extends SectionedDeck>(
    deck: D,
    selectedSlideIds: SlideId[],
    sectionId: string = (0, runtime.createModelId)(),
  ): D | undefined {
    let values: Set<SlideId> = new Set(selectedSlideIds),
      value: SlideId[] = deck.order.filter((input) => values.has(input)),
      value2: DeckSection[] =
        reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [];
    if (
      value.length === 0 ||
      value.length !== values.size ||
      value2.some((input) => input.id === sectionId)
    ) {
      return;
    }
    let value3: SectionGroup[] = sectionGroups(value2, deck.order),
      value4: number = value3.findIndex((input) =>
        input.ids.includes(value[0]!),
      ),
      ids: SlideId[] = value3[value4]!.ids,
      value5: number = ids.indexOf(value[0]!);
    if (
      value5 === 0 &&
      value.length === ids.length &&
      ids.every((input) => values.has(input))
    ) {
      return;
    }
    let value6: SlideId[] = ids
        .slice(value5 + 1)
        .filter((input) => !values.has(input)),
      value7: SlideId | undefined =
        value6.length > 0 && !(value5 === 0 && value3[value4]!.section !== null)
          ? value6[0]
          : undefined;
    if (
      value2.length + (value7 !== undefined ? 2 : 1) >
      runtime.maxDeckSections
    ) {
      return;
    }
    let value8: SlideId | null =
      value6[0] ?? firstSlideAfterSectionGroup(value3, value4);
    while (value8 !== null && values.has(value8))
      value8 = deck.order[deck.order.indexOf(value8) + 1] ?? null;
    let { order: value9, sections: value10 } = detachSlidesForSectionMove(
        deck,
        value2,
        value,
        value8,
      ),
      values2: Set<string> = new Set(
        value5 === 0 ? precedingEmptySectionIds(value3, value4) : [],
      ),
      items: DeckSection[] = [
        ...value10.map((input) =>
          values2.has(input.id)
            ? {
                ...input,
                before: value[0],
              }
            : input,
        ),
        {
          id: sectionId,
          description: "",
          start: value[0],
        },
        ...(value7 !== undefined
          ? [
              {
                id: (0, runtime.createModelId)(),
                description: "",
                start: value7,
              },
            ]
          : []),
      ];
    return {
      ...deck,
      order: value9,
      sections: reconcileSectionsWithSlideOrder(items, value9),
    };
  }
  function detachSlidesForSectionMove(
    deck: SectionedDeck,
    sections: DeckSection[] | undefined,
    slideIds: SlideId[],
    beforeSlideId: SlideId | null,
  ): { order: SlideId[]; sections: DeckSection[] } {
    let value: DeckSection[] | undefined = sections,
      order: SlideId[] = deck.order;
    for (let value5 of slideIds) {
      value = removeSlideFromSections(value, order, value5);
      order = order.filter((input) => input !== value5);
    }
    let value2: SlideId[] = order,
      value3: number =
        beforeSlideId === null ? value2.length : value2.indexOf(beforeSlideId),
      value4: number = value3 < 0 ? value2.length : value3;
    return {
      order: [...value2.slice(0, value4), ...slideIds, ...value2.slice(value4)],
      sections: value ?? [],
    };
  }
  /** `beforeSlideId` is the index within the target section's slides at which the moved slides land. */
  function moveSlidesToSection<D extends SectionedDeck>(
    deck: D,
    selectedSlideIds: SlideId[],
    sectionId: string | null,
    beforeSlideId: number,
  ): D | undefined {
    let values: Set<SlideId> = new Set(selectedSlideIds),
      value: SlideId[] = deck.order.filter((input) => values.has(input));
    if (value.length === 0 || value.length !== values.size) {
      return;
    }
    let value2: DeckSection[] =
        reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [],
      value3 = detachSlidesForSectionMove(deck, value2, value, null),
      value4: SlideId[] = value3.order.slice(
        0,
        value3.order.length - value.length,
      ),
      sections: DeckSection[] = value3.sections,
      value5: DeckSection | undefined =
        sectionId === null
          ? undefined
          : value2.find((input) => input.id === sectionId);
    if (
      value5 !== undefined &&
      !sections.some((input) => input.id === sectionId)
    ) {
      let value12: SectionGroup[] = sectionGroups(value2, deck.order),
        value13: SlideId | null = firstSlideAfterSectionGroup(
          value12,
          value12.findIndex((input) => input.section?.id === sectionId),
        );
      while (value13 !== null && values.has(value13))
        value13 = deck.order[deck.order.indexOf(value13) + 1] ?? null;
      sections = preserveEmptySectionOrder(
        [
          ...sections,
          {
            id: value5.id,
            ...sectionDescriptionFields(value5),
            before: value13,
            seq: Date.now(),
          },
        ],
        value2,
        deck.order,
        value4,
      );
    }
    let value6: SectionGroup[] = sectionGroups(sections, value4),
      value7: number =
        sectionId === null
          ? value6.findIndex((input) => input.section === null)
          : value6.findIndex((input) => input.section?.id === sectionId);
    if (value7 < 0 && sectionId !== null) {
      return;
    }
    let value8: SlideId[] = value7 < 0 ? [] : value6[value7]!.ids,
      value9: number = Math.max(0, Math.min(value8.length, beforeSlideId)),
      value10: SlideId | null =
        value9 < value8.length
          ? value8[value9]!
          : value7 < 0
            ? (value4[0] ?? null)
            : firstSlideAfterSectionGroup(value6, value7),
      value11: number =
        value10 === null ? value4.length : value4.indexOf(value10),
      items: SlideId[] = [
        ...value4.slice(0, value11),
        ...value,
        ...value4.slice(value11),
      ];
    if (sectionId !== null && value9 === 0) {
      let values2: Set<string> = new Set(
        value8.length === 0 ? precedingEmptySectionIds(value6, value7) : [],
      );
      sections = sections.map((input) =>
        input.id === sectionId
          ? {
              id: input.id,
              ...sectionDescriptionFields(input),
              start: value[0],
            }
          : values2.has(input.id)
            ? {
                ...input,
                before: value[0],
              }
            : input,
      );
    }
    let state = {
      ...deck,
      order: items,
    };
    if (sections.length > 0 || deck.sections !== undefined) {
      state.sections = reconcileSectionsWithSlideOrder(sections, items);
    }
    if (
      items.join("\x00") === deck.order.join("\x00") &&
      (sectionsEqual(deck.sections, state.sections) ||
        deckSectionLayoutsEqual(deck, state))
    ) {
      return;
    }
    return state;
  }
  function insertSlidesAtSectionTarget<D extends SectionedDeck>(
    deck: D,
    slideIds: SlideId[],
    target: SectionInsertTarget,
    sectionId: string = (0, runtime.createModelId)(),
    splitSectionId: string = (0, runtime.createModelId)(),
  ): D | undefined {
    let values: Set<SlideId> = new Set(slideIds),
      state = {
        ...deck,
        order: [
          ...deck.order.filter((input) => !values.has(input)),
          ...slideIds,
        ],
      };
    if ("gapIndex" in target) {
      return moveSlidesIntoNewSection(
        state,
        slideIds,
        target.gapIndex,
        sectionId,
        splitSectionId,
      );
    }
    if (
      target.sectionId !== null &&
      !sectionGroups(
        reconcileSectionsWithSlideOrder(deck.sections, deck.order),
        deck.order,
      ).some((input) => input.section?.id === target.sectionId)
    ) {
      return;
    }
    return (
      moveSlidesToSection(state, slideIds, target.sectionId, target.index) ??
      state
    );
  }
  function deckSectionLayoutsEqual(
    deck: SectionedDeck,
    otherDeck: SectionedDeck,
  ): boolean {
    let callback = (input: SectionedDeck): string =>
      sectionGroups(
        reconcileSectionsWithSlideOrder(input.sections, input.order),
        input.order,
      )
        .map(
          (input2) =>
            (input2.section?.id ?? "") +
            ":" +
            (input2.section?.description ?? "") +
            ":" +
            input2.ids.join(","),
        )
        .join("|");
    return callback(deck) === callback(otherDeck);
  }
  function deleteSection<D extends SectionedDeck>(
    deck: D,
    sectionId: string,
  ): D | undefined {
    let value: DeckSection[] =
      reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [];
    if (!value.some((input) => input.id === sectionId)) {
      return;
    }
    return {
      ...deck,
      sections: reconcileSectionsWithSlideOrder(
        value.filter((input) => input.id !== sectionId),
        deck.order,
      ),
    };
  }
  function renameSection<D extends SectionedDeck>(
    deck: D,
    sectionId: string,
    description: string,
  ): D | undefined {
    let value: DeckSection[] =
        reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [],
      value2: DeckSection | undefined = value.find(
        (input) => input.id === sectionId,
      ),
      value3: string = (0, runtime.normalizeDescription)(
        description,
        runtime.maxSectionDescriptionLength,
      );
    if (value2 === undefined || value3 === value2.description) {
      return;
    }
    let {
        id: value4,
        description: value5,
        title: value6,
        ...value7
      }: DeckSection = value2,
      state: DeckSection = {
        id: sectionId,
        description: value3,
        ...value7,
      };
    return {
      ...deck,
      sections: value.map((input) => (input.id === sectionId ? state : input)),
    };
  }
  function moveSectionToGap<D extends SectionedDeck>(
    deck: D,
    sectionId: string,
    gapIndex: number,
  ): D | undefined {
    let value: DeckSection[] =
        reconcileSectionsWithSlideOrder(deck.sections, deck.order) ?? [],
      value2: SectionGroup[] = sectionGroups(value, deck.order),
      value3: number = value2.findIndex(
        (input) => input.section?.id === sectionId,
      );
    if (
      value3 < 0 ||
      gapIndex < 0 ||
      gapIndex > value2.length ||
      gapIndex === value3 ||
      gapIndex === value3 + 1
    ) {
      return;
    }
    let ids: SlideId[] = value2[value3]!.ids;
    if (ids.length > 0 && gapIndex === 0 && value2[0]!.section === null) {
      if (value.length >= runtime.maxDeckSections) {
        return;
      }
      value = [
        ...value,
        {
          id: (0, runtime.createModelId)(),
          description: "",
          start: value2[0]!.ids[0],
        },
      ];
    }
    let value4: SlideId | null = firstSlideAfterSectionGroup(
      value2,
      gapIndex - 1,
    );
    while (value4 !== null && ids.includes(value4))
      value4 = firstSlideAfterSectionGroup(
        value2,
        value2.findIndex((input) => input.ids.includes(value4!)),
      );
    if (ids.length === 0) {
      let value10: DeckSection[] = value.map((input) =>
          input.id !== sectionId
            ? input
            : {
                ...input,
                before: value4,
                seq: Date.now(),
              },
        ),
        value11: DeckSection[] | undefined = reconcileSectionsWithSlideOrder(
          emptySectionRunIds(value10, value2, gapIndex, sectionId),
          deck.order,
        );
      if (sectionsEqual(value, value11)) {
        return undefined;
      } else {
        return {
          ...deck,
          sections: value11,
        };
      }
    }
    let value5: SlideId[] = deck.order.filter((input) => !ids.includes(input)),
      value6: number =
        value4 === null ? value5.length : value5.indexOf(value4),
      items: SlideId[] = [
        ...value5.slice(0, value6),
        ...ids,
        ...value5.slice(value6),
      ],
      values: Set<string> = new Set(precedingEmptySectionIds(value2, gapIndex)),
      values2: Set<string> = new Set();
    for (
      let value10 = gapIndex;
      value10 < value2.length &&
      value2[value10]!.section !== null &&
      value2[value10]!.ids.length === 0;
      value10++
    )
      values2.add(value2[value10]!.section!.id);
    let values3: Set<SlideId> = new Set(ids),
      value7: SlideId | null = firstSlideAfterSectionGroup(value2, value3),
      value8: DeckSection[] = value.map((input) =>
        values.has(input.id)
          ? {
              ...input,
              before: ids[0],
            }
          : values2.has(input.id) && input.before === ids[0]
            ? {
                ...input,
                before: value4,
              }
            : isEmptySection(input) &&
                typeof input.before === "string" &&
                values3.has(input.before)
              ? {
                  ...input,
                  before: value7,
                }
              : input,
      ),
      value9: DeckSection[] | undefined = reconcileSectionsWithSlideOrder(
        value8,
        items,
      );
    if (
      items.join("\x00") === deck.order.join("\x00") &&
      sectionsEqual(deck.sections, value9)
    ) {
      return;
    }
    if (sectionsEqual(deck.sections, value9)) {
      return {
        ...deck,
        order: items,
      };
    } else {
      return {
        ...deck,
        order: items,
        sections: value9,
      };
    }
  }
  function moveSectionsToGap<D extends SectionedDeck>(
    deck: D,
    sectionIds: string[],
    gapIndex: number,
  ): D | undefined {
    let values: Set<string> = new Set(sectionIds),
      value: SectionGroup[] = sectionGroups(
        reconcileSectionsWithSlideOrder(deck.sections, deck.order),
        deck.order,
      ),
      value2: number[] = value.flatMap((input, options): number[] =>
        input.section !== null && values.has(input.section.id) ? [options] : [],
      ),
      value3: string[] = value2.map((input) => value[input]!.section!.id);
    if (
      value3.length === 0 ||
      (value2[value2.length - 1]! - value2[0]! === value2.length - 1 &&
        gapIndex >= value2[0]! &&
        gapIndex <= value2[value2.length - 1]! + 1)
    ) {
      return;
    }
    let value4: D = deck,
      value5: number = gapIndex;
    for (let value6 of value3) {
      value4 = moveSectionToGap(value4, value6, value5) ?? value4;
      value5 =
        sectionGroups(
          reconcileSectionsWithSlideOrder(value4.sections, value4.order),
          value4.order,
        ).findIndex((input) => input.section?.id === value6) + 1;
    }
    if (
      value4.order.join("\x00") === deck.order.join("\x00") &&
      sectionsEqual(deck.sections, value4.sections)
    ) {
      return undefined;
    } else {
      return value4;
    }
  }
  function diffSections(
    previousDeck: SectionedDeck,
    deck: SectionedDeck,
  ): SectionsDiff {
    let previousSections: DeckSection[] = previousDeck.sections ?? [],
      sections: DeckSection[] = deck.sections ?? [],
      previousById: Map<string, DeckSection> = new Map(
        previousSections.map((input): [string, DeckSection] => [
          input.id,
          input,
        ]),
      ),
      sectionsById: Map<string, DeckSection> = new Map(
        sections.map((input): [string, DeckSection] => [input.id, input]),
      ),
      changed: SectionChange[] = [];
    for (let [value, value2] of previousById) {
      let entry: DeckSection | undefined = sectionsById.get(value);
      if (entry === undefined) {
        continue;
      }
      let state: SectionFieldValues = {},
        state2: SectionFieldValues = {};
      for (let value3 of sectionDiffFields)
        if (value2[value3] !== entry[value3]) {
          state[value3] = value2[value3] ?? null;
          state2[value3] = entry[value3] ?? null;
        }
      if (Object.keys(state2).length > 0) {
        changed.push({
          id: value,
          from: state,
          to: state2,
          was: value2,
          now: entry,
        });
      }
    }
    return {
      added: sections.filter((input) => !previousById.has(input.id)),
      removed: previousSections.filter((input) => !sectionsById.has(input.id)),
      changed: changed,
      ...(previousDeck.order.join("\x00") !== deck.order.join("\x00")
        ? {
            order: {
              from: [...previousDeck.order],
              to: [...deck.order],
            },
          }
        : {}),
    };
  }
  function invertSectionsDiff(diff: SectionsDiff): SectionsDiff {
    return {
      added: diff.removed,
      removed: diff.added,
      changed: diff.changed.map(
        (input): SectionChange => ({
          id: input.id,
          from: input.to,
          to: input.from,
          was: input.now,
          now: input.was,
        }),
      ),
      ...(diff.order !== undefined
        ? {
            order: {
              from: diff.order.to,
              to: diff.order.from,
            },
          }
        : {}),
    };
  }
  function applySectionFields(
    section: DeckSection,
    patch: SectionFieldValues,
  ): DeckSection {
    let state: RawRecord = {
      ...section,
    };
    for (let value of sectionDiffFields) {
      if (!(value in patch)) {
        continue;
      }
      let value2: string | number | null | undefined = patch[value];
      if (value2 === null && value !== "before") {
        delete state[value];
      } else {
        state[value] = value2;
      }
    }
    if ("description" in patch) {
      delete state.title;
    }
    if (state.start !== undefined) {
      delete state.before;
      delete state.seq;
    } else if (!("before" in state)) {
      state.before = null;
    }
    return state as unknown as DeckSection;
  }
  function applySectionsDiff<D extends SectionedDeck>(
    deck: D,
    diff: SectionsDiff,
  ): D {
    let sections: DeckSection[] = [...(deck.sections ?? [])],
      removedIds: Set<string> = new Set(diff.removed.map((input) => input.id));
    sections = sections.filter((input) => !removedIds.has(input.id));
    let sectionsById: Map<string, DeckSection> = new Map(
        sections.map((input): [string, DeckSection] => [input.id, input]),
      ),
      addedIds: Set<string> = new Set();
    for (let value of diff.added)
      if (
        !sections.some((input) => input.id === value.id) &&
        sections.length < runtime.maxDeckSections
      ) {
        sections.push({
          ...value,
        });
        addedIds.add(value.id);
      }
    for (let value of diff.changed)
      if (
        (addedIds.add(value.id), sections.some((input) => input.id === value.id))
      ) {
        sections = sections.map((input) =>
          input.id === value.id ? applySectionFields(input, value.to) : input,
        );
      } else if (sections.length < runtime.maxDeckSections) {
        sections.push({
          ...value.now,
        });
      }
    let values: Set<SlideId> = new Set(deck.order);
    sections = sections.flatMap((input): DeckSection[] => {
      if (!addedIds.has(input.id) || input.start === undefined) {
        return [input];
      }
      let value: DeckSection = input;
      if (!values.has(input.start)) {
        value = sectionsById.get(input.id) ?? {
          id: input.id,
          ...sectionDescriptionFields(input),
          before: null,
          seq: Date.now(),
        };
      } else if (
        sections.some(
          (input2) =>
            input2.id !== input.id &&
            input2.start === input.start &&
            !addedIds.has(input2.id),
        )
      ) {
        value = {
          id: input.id,
          ...sectionDescriptionFields(input),
          before: input.start,
          seq: Date.now(),
        };
      }
      if (
        value !== input &&
        isEmptySection(value) &&
        !sectionHasDescription(value)
      ) {
        return [];
      } else {
        return [value];
      }
    });
    let order: SlideId[] = deck.order;
    if (diff.order !== undefined) {
      let values2: Set<SlideId> = new Set(deck.order),
        value: SlideId[] = diff.order.to.filter((input) => values2.has(input));
      deck.order.forEach((input, options) => {
        if (value.includes(input)) {
          return;
        }
        let value2: SlideId | undefined = deck.order
          .slice(0, options)
          .reverse()
          .find((input2) => value.includes(input2));
        value.splice(
          value2 === undefined ? 0 : value.indexOf(value2) + 1,
          0,
          input,
        );
      });
      order = value;
    }
    let state = {
      ...deck,
      order: order,
    };
    if (sections.length > 0 || deck.sections !== undefined) {
      state.sections = reconcileSectionsWithSlideOrder(sections, order);
    }
    return state;
  }
  bindRuntimeValue(runtime, "normalizeSections", () => normalizeSections);
  bindRuntimeValue(
    runtime,
    "anchoredSectionsInOrder",
    () => anchoredSectionsInOrder,
  );
  bindRuntimeValue(runtime, "sectionGroups", () => sectionGroups);
  bindRuntimeValue(
    runtime,
    "reconcileSectionsWithSlideOrder",
    () => reconcileSectionsWithSlideOrder,
  );
  bindRuntimeValue(
    runtime,
    "normalizeEmptySectionDescriptions",
    () => normalizeEmptySectionDescriptions,
  );
  bindRuntimeValue(
    runtime,
    "removeSlideFromSections",
    () => removeSlideFromSections,
  );
  bindRuntimeValue(
    runtime,
    "preserveEmptySectionOrder",
    () => preserveEmptySectionOrder,
  );
  bindRuntimeValue(runtime, "sectionsEqual", () => sectionsEqual);
  bindRuntimeValue(
    runtime,
    "firstSlideAfterSectionGroup",
    () => firstSlideAfterSectionGroup,
  );
  bindRuntimeValue(
    runtime,
    "precedingEmptySectionIds",
    () => precedingEmptySectionIds,
  );
  bindRuntimeValue(runtime, "emptySectionRunIds", () => emptySectionRunIds);
  bindRuntimeValue(runtime, "addSectionAtSlide", () => addSectionAtSlide);
  bindRuntimeValue(
    runtime,
    "addEmptySectionBeforeSlide",
    () => addEmptySectionBeforeSlide,
  );
  bindRuntimeValue(runtime, "addSectionAtGap", () => addSectionAtGap);
  bindRuntimeValue(runtime, "appendEmptySection", () => appendEmptySection);
  bindRuntimeValue(
    runtime,
    "moveSlidesIntoNewSection",
    () => moveSlidesIntoNewSection,
  );
  bindRuntimeValue(
    runtime,
    "createSectionFromSlides",
    () => createSectionFromSlides,
  );
  bindRuntimeValue(
    runtime,
    "detachSlidesForSectionMove",
    () => detachSlidesForSectionMove,
  );
  bindRuntimeValue(runtime, "moveSlidesToSection", () => moveSlidesToSection);
  bindRuntimeValue(
    runtime,
    "insertSlidesAtSectionTarget",
    () => insertSlidesAtSectionTarget,
  );
  bindRuntimeValue(
    runtime,
    "deckSectionLayoutsEqual",
    () => deckSectionLayoutsEqual,
  );
  bindRuntimeValue(runtime, "deleteSection", () => deleteSection);
  bindRuntimeValue(runtime, "renameSection", () => renameSection);
  bindRuntimeValue(runtime, "moveSectionToGap", () => moveSectionToGap);
  bindRuntimeValue(runtime, "moveSectionsToGap", () => moveSectionsToGap);
  bindRuntimeValue(runtime, "diffSections", () => diffSections);
  bindRuntimeValue(runtime, "invertSectionsDiff", () => invertSectionsDiff);
  bindRuntimeValue(runtime, "applySectionFields", () => applySectionFields);
  bindRuntimeValue(runtime, "applySectionsDiff", () => applySectionsDiff);
  bindRuntimeValue(
    runtime,
    "sectionIdPattern",
    () => sectionIdPattern,
    (value) => {
      sectionIdPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isEmptySection",
    () => isEmptySection,
    (value) => {
      isEmptySection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sectionHasDescription",
    () => sectionHasDescription,
    (value) => {
      sectionHasDescription = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sectionDescriptionFields",
    () => sectionDescriptionFields,
    (value) => {
      sectionDescriptionFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeSectionDescription",
    () => normalizeSectionDescription,
    (value) => {
      normalizeSectionDescription = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "emptySectionHasNoDescription",
    () => emptySectionHasNoDescription,
    (value) => {
      emptySectionHasNoDescription = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sectionDiffFields",
    () => sectionDiffFields,
    (value) => {
      sectionDiffFields = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeSections",
    () => initializeSections,
    (value) => {
      initializeSections = value;
    },
  );
  return () => {
    isEmptySection = (input: DeckSection): boolean => input.start === undefined;
    sectionHasDescription = (input: DeckSection): boolean =>
      input.description !== "";
    sectionDescriptionFields = (input: DeckSection): SectionDescriptionFields =>
      input.title !== undefined
        ? {
            title: input.title,
            description: input.description,
          }
        : {
            description: input.description,
          };
    normalizeSectionDescription = (input: unknown, options: number): string =>
      (0, runtime.normalizeDescription)(
        typeof input === "string" ? input.slice(0, options * 4) : input,
        options,
      );
    emptySectionHasNoDescription = (input: DeckSection): boolean =>
      isEmptySection(input) && !sectionHasDescription(input);
    initializeSections = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      sectionIdPattern = /^[\w-]{1,64}$/;
      sectionDiffFields = ["description", "start", "before", "seq"];
    });
  };
}
