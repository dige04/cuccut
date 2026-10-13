# Shot cards, transition descriptions and camera checks

The details of `SKILL.md` section 3: how to fill each card, how to write transition descriptions, how to check camera moves, and what the two summary tables look like.

## 1. Shot card fields

| Field | What to write |
| --- | --- |
| Narrative role | Establish, develop, climax, resolve, transition, or supplement (close-up, detail, reaction, insert, empty shot, point of view) |
| Pace | Slow, medium, fast |
| Scene | The environment: where, when, what is there |
| Action | Subject + action + path, one sentence |
| Transition description | 2-4 sentences, see section 2 |
| Target duration | 3-10 seconds |
| Camera move | Static, pan, tilt, dolly, zoom, crane, orbit, handheld, or a combination |
| First-frame composition | Shot size + angle + composition (for example "medium shot, eye level, subject in the left third") |
| First-frame visible content | Everything visible in the first frame |
| Shot boundary | Continuous (the picture carries on from the previous shot) or cut |
| First-frame reuse | Yes or no; when yes, the first frame is the last frame the previous shot actually produced |
| Picture source | User assets, generated images, code visuals, or a combination |
| Dialogue | "Character: line", or none; on-screen speech becomes off-screen or subtitles per `SKILL.md` section 5 |
| Sound effects | The sound source, or none |
| Music cue | For separate music: mood, arrangement density (sparse, moderate, full), light or dark; when needed, which of the core instruments this passage uses. Adjacent shots with the same mood can have the same cue |
| Narration budget | The total seconds of the shots this narration passage covers, written on the passage's first card |
| Narration text | The full narration, or "continued from previous shot", or none |

Constraints between fields:

- When the shot boundary is "continuous", the next shot's first-frame reuse is "yes".
- A shot with first-frame reuse "yes" can only be made once the previous shot has really been produced; shots chained this way are made in order, not in parallel.

## 2. How to write transition descriptions

The transition description directly decides how the shot comes out; the more concrete, the better. It needs all four of these:

1. **The subject's appearance**: the features that must stay consistent from start to finish.
2. **Motion path**: how the subject and the camera move through space, from where to where.
3. **State change**: how objects and the environment change over these seconds.
4. **What is always present**: what is there from the first frame and stays, so it does not appear or vanish out of nowhere midway.

| Not enough | Enough |
| --- | --- |
| The chart goes up | A bar chart on a dark background is there from the first frame, all five bars showing only their bases. The bars rise from left to right in turn, each growing to its value in about half a second, with the number on top rolling up with the height. The last bar is the tallest, and on reaching the top it turns from gray to the accent color; the axes and title never move. |
| A paper plane flies across the desk | A white folded paper plane sets off from the bottom-left corner of the frame and flies to the upper right along a slightly rising arc, wings kept level. The desk lamp and notebook on the desk stay in place throughout; as the plane passes, it casts a moving shadow on the desk, and at the end it just leaves through the right edge of the frame. |
| It gets dark | Outside the window it starts with orange evening light and gradually turns deep blue over the shot, while the windows of the building opposite light up warm yellow one after another. The bookshelf and plants indoors stay in the picture throughout, going from lit by daylight to lit by the desk lamp. |

Code visuals follow the same pattern: the transition description is the spec for the shot's animation, and the rendering code implements it.

## 3. Physical consistency of camera moves

| Camera move | Must satisfy |
| --- | --- |
| Pan, tilt, zoom | The camera stays in place: it can only show what rotating in place or zooming in and out can show |
| Dolly, tracking, crane | The camera moves: the path is really walkable in the scene, and the distance can be covered within the duration |
| Orbit | The subject stays in the middle of the frame throughout, with room to circle around it |
| Handheld | As for dolly, with irregular shake allowed |
| Combination | Satisfies each move involved at the same time |

Common mistakes and fixes:

| Mistake | Fix |
| --- | --- |
| "Pan from the corridor entrance to the middle of the corridor": the camera actually has to walk forward | Change to a dolly or tracking shot |
| A shot starts in the living room and ends on the balcony, with no walkable path between | Split into two shots |
| Crossing a whole square in 5 seconds | Lengthen the duration, or shorten the distance |

Camera moves on stills and code visuals are scaling and panning, likewise limited by the picture's extent: a push-in goes no further than the source resolution can hold, and a pan does not cross the image's edge; for large-range motion, produce a big enough image first.

## 4. The two summary tables

**Reference image needs**:

| Element | Shots used in (shot size) | Images to produce |
| --- | --- | --- |
| (identifier name) | Shot 2 (medium), shot 5 (close-up) | Full-body front, face close-up |

List only images the shots actually use.

**Music mood arc** (only for separate music): compute start and end times from each shot's target duration and take each shot's music cue; merge adjacent shots with the same mood, arrangement density and light or dark into one row.

| Time span | Mood | Arrangement density | Instruments for this passage (optional) |
| --- | --- | --- | --- |
| 00:00-00:12 | Calm, curious | Sparse | Piano |
| 00:12-00:20 | Tense, accelerating | Moderate | Piano, percussion |

When making the music, use only this table and do not start another: when generating one piece, write its overall course into the style description; when generating in sections, each row (or several adjacent rows with similar moods) becomes one section, with times and moods per the table.
