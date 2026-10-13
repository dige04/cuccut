# Images and illustrations in slides

This page covers where slide images come from, which slides should have them, and what illustrations should look like. For how to call image generation (checking capabilities, differences between services, prompt order, checks, and what to do when it cannot draw), use `skills_read` to read `cuccut-catalog-media`, section "Generating images"; how to write `<img>` is in section 5 of `references/format.md`, and how to place images in the layout is in section 6 of `references/design.md`.

## 1. Which slides get images

- Images are optional. A well-structured deck without images is still a good delivery; do not force images in "for looks".
- Sources, in order: images the user gave and images in the working directory; illustrations drawn with an image generation model; if neither, no image.
- Slides suited to illustrations: the cover, section slides, quote or key-line slides, and concept slides that need a concrete picture to help understanding (a metaphor, a scene, a mood).
- Slides that get no illustrations: slides with data, charts, flows or screenshots (use tables, `<div>` bars, `<x-shape>` and inline `<svg>`); slides that must show the real thing, such as the user's product and UI, team, office, customers, events, real people, logos. Leave a placeholder image frame there (section 4) and ask the user for the real image.
- Count: usually two to five per deck, each used once, not one on every slide. When the user asked for images or illustrations, draw as needed; when the user said no images, draw none; when the user did not mention it, illustrate only the two or three slides that benefit most (cover, section slides), tell the user which ones along with the outline, and wait for the user to ask for more. A local model takes several minutes or more per image, so set the count by how long the wait can be.

## 2. What they should look like

- The style description follows the deck: the image type matches the slides' visual direction (flat vector illustration, small isometric 3D scene, paper-craft collage, soft-light realistic photography…); write the deck's background and accent color values directly into it, and use a dark key for images on dark slides and a light key for images on light slides. Use only this one description for the whole deck and include it verbatim with every image.
- Leave room for text: when the slide's text sits on the image, state in the composition which side the subject is on and that the other side (or the top third) is a large clean empty area; a full-slide background image needs a simple, low-contrast background. Titles, labels and numbers are written with real `<p>` elements on the slide; never let the model draw text.
- Aspect ratio follows the image's frame on the slide: full-slide backgrounds and wide strips `16:9`; half-slide portrait images in a two-column layout `3:4` or `2:3`; side-by-side square images `1:1`; landscape accompanying images `4:3`. When the ratio does not match, crop into the frame on the slide with `object-fit:cover`, using `data-crop` to pick the focus if needed; when the model does not accept a size, state landscape or portrait in the prompt.
- One image per slide; draw extras only when the user wants to choose.

## 3. After drawing

1. Submit all the images at once, without `video` (these images do not go into a video), and note which slide each one is for.
2. Save the results in `images/` under the deck directory, named after the slide id (for example `q3-review/images/cover.png`); if a file with that name exists, use another name (`cover-2.png`), do not overwrite.
3. Import the ones that pass review into the deck as in step 4 of "Making a new deck", and set `src` to the address the import returns; `alt` says in a few words what the image shows. If one fails and redrawing does not fix it, switch that slide to a layout without an image.
4. When image generation is unavailable, still make the whole deck, leaving placeholder image frames where images belong or switching to layouts without images, and say so at delivery.

## 4. Placeholder image frames

When a slide needs the real thing (product screenshot, team photo, logo) and the user has not given it, or image generation is unavailable, write an `<img>` with only `alt` and width/height and no `src` where the image belongs:

```html
<img alt="Goes here: screenshot of the new timeline" style="width:960px;height:540px;object-fit:contain">
```

It holds its place in the layout and passes validation; the user selects it in the editor to upload the image. At delivery, list what each frame should contain. Never fill in for the real thing with an image from elsewhere, a web address or a generated "illustrative" image.

## 5. Revisions and delivery

- When the user wants a generated image replaced: keep the same style description, change only what needs changing and redraw; after importing, change only the `src` of that slide's `<img>` to the new address and leave everything else; there is no need to delete the old image from `assets/`.
- At delivery, list in one sentence which slides use generated illustrations and which service and model drew them, and tell the user they can swap them in the editor; the originals are in `images/`.
