# Anthropic brand color system

Source: `colors.css` from the design team's anthropic-design skill (2025-12-11). In .dc.html artboards, use these values in inline styles.

## Primary colors (the foundation: most surfaces use only these two)

| Name  | Hex       | Use |
|-------|-----------|-----|
| Ivory | `#FAF9F5` | Page/artboard background. Never use pure #FFF for a full-page background. |
| Slate | `#141413` | Text, dark surfaces. |

Content surfaces (cards, panels) use `#FFFFFF` on top of Ivory. Tinted hover/selected surfaces: `rgba(115,114,108,0.1)`. Borders derive from low-opacity Slate: default `0.5px solid rgba(31,30,29,0.15)`, one step stronger `rgba(31,30,29,0.3)`; never use colored borders to divide structure.

## Claude colors

| Token | Hex | |
|-------|-----|---|
| Claude primary (Clay, the Spark color) | `#D97757` | accent; the only emphasis color on Claude surfaces |
| Claude background (Ivory) | `#FAF9F5` | |
| Claude text (Slate) | `#141413` | |
| Claude accent (Oat) | `#E3DACC` | light fills, dividers |
| Main accent (Blue) | `#2A78D6` | main accent for non-Claude actions |

## Secondary colors (multicolor: for illustration and composition, not UI chrome)

Strong: Fig `#C46686` · Sky `#6A9BCC` · Olive `#788C5D` · Clay `#D97757`
Soft: Coral `#EBCECE` · Heather `#CBCADB` · Cactus `#BCD1CA` · Oat `#E3DACC`

## Warm gray scale (21 steps, black → white)

`#000000` 1000 · `#141413` 950 (Slate) · `#1A1918` 900 · `#1F1E1D` 850 ·
`#262624` 800 · `#30302E` 750 · `#3D3D3A` 700 · `#4D4C48` 650 ·
`#5E5D59` 600 · `#73726C` 550 · `#87867F` 500 · `#9C9A92` 450 ·
`#B0AEA5` 400 · `#C2C0B6` 350 · `#D1CFC5` 300 · `#DEDCD1` 250 ·
`#E8E6DC` 200 · `#F0EEE6` 150 · `#F5F4ED` 100 · `#FAF9F5` 050 (Ivory) ·
`#FFFFFF` 000

These are **warm** grays: never swap in a cool or neutral gray ramp.

## Tertiary scales (marketing/slides/data visualization, **not** product UI)

Orange, yellow, green, teal, blue, purple, magenta and red each have a nine-step scale; their 500 anchors: orange `#D97757`, yellow `#C9A82D`, green `#558A42`, teal `#2E9191`, blue `#6A9BCC`, purple `#6B4D9E`, magenta `#A64D87`. Use them only for chart and illustration accents; UI that looks like product stays within the primary colors + gray scale.
