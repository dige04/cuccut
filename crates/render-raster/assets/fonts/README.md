# Supplementary Subtitle Design Fonts

`subtitle-design-fonts.json` pins the source file, SHA-256 and OFL license file for each of the six fonts. The source files are the WOFF2 files each font is published as under the OFL 1.1 license (the file names are in each entry's `source` field in the manifest). fontTools unpacks the WOFF2 files into sfnt TTF without modifying names or glyphs; the corresponding version is identified by the source file and the output digest.

Inter Medium, Poppins Black, Roboto Mono Medium, Playfair Display Regular/Italic and Oswald Bold are bundled with App/Runtime/Web. The actual family names follow the font's internal tables, and Poppins Black is registered separately. The OFL text is kept. Text not covered by these fonts uses the existing Noto/system fallback. Supplementary fonts are appended to the end of the core font order so that existing atlas face ids do not change.
