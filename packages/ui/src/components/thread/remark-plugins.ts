import remarkCjkFriendly from 'remark-cjk-friendly/parseOnly';
import remarkCjkFriendlyGfmStrikethrough from 'remark-cjk-friendly-gfm-strikethrough/parseOnly';
import remarkGfm from 'remark-gfm';

/**
 * The remark plugins used for rendering Markdown in the UI: GFM, plus CJK-friendly emphasis and strikethrough rules.
 * CommonMark's delimiter rules require `**` to be flanked by whitespace or punctuation, so CJK writing such as `建议**确定**后` or `**粗体。**接着` would show the asterisks as raw text. remark-cjk-friendly relaxes this rule, and GFM's `~~` is handled the same way by remark-cjk-friendly-gfm-strikethrough. It only parses; the UI does not write Markdown back.
 */
export const remarkPlugins = [remarkGfm, remarkCjkFriendly, remarkCjkFriendlyGfmStrikethrough];
