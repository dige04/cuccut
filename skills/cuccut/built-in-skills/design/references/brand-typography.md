# Anthropic brand typography

Source: `typography.css` from the design team's anthropic-design skill (2025-12-11). Font **files** are deliberately not included here (see README.md); write the specified family first, then an honest fallback: wherever the Anthropic fonts are not installed, the fallback stack renders.

## Font stacks (use verbatim in inline styles)

- Sans (UI text, labels, body text):
  `'Anthropic Sans', system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- Serif (display headings, editorial voice):
  `'Anthropic Serif', Georgia, 'Times New Roman', Times, serif`
- Mono (code):
  `'Anthropic Mono', 'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace`

Anthropic Sans and Serif are both variable, weights 300–800.

## Type scale (from the brand type system)

| Role | Family | Size | Weight | Line height |
|------|--------|------|--------|-------------|
| Display (hero) | Serif | 38px | 330 | 1.2 |
| Title | Serif | 28px | 500 | 1.3 |
| Heading | Serif | 24px | 500 | 1.3 |
| UI XL | Sans | 20px | 400 | 1.4 |
| Body | Sans | 16px | 400 | 1.5 |
| Small/labels | Sans | 14px | 400 | 1.4 |
| Caption | Sans | 12px | 400 | 1.35 |

Keep letter-spacing at 0; the brand feel comes from the warm palette, generous whitespace, and serif display type with sans-serif body text, not from tracking tricks. Headings use Serif at moderate weights (330–500), never faux bold. When a brand feel is needed, do not make the overused AI default families (Inter, Roboto, Arial, Fraunces) the first choice; Arial/Helvetica appear only in fallback stacks.
