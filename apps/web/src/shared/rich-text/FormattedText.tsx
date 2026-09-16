import { formatRichTextToHtml } from "./format-rich-text";

type Props = {
  text: string;
  className?: string;
};

export function FormattedText({ text, className }: Props) {
  if (!text.trim()) return null;
  return (
    <div
      className={className ?? "comms-rich-preview"}
      dangerouslySetInnerHTML={{ __html: formatRichTextToHtml(text) }}
    />
  );
}
