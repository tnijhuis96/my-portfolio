export type PortableTextBlock = {
  children?: Array<{ text?: string }>;
};

export function blocksToParagraphs(blocks: PortableTextBlock[] = []) {
  return blocks
    .map((block) =>
      (block.children ?? [])
        .map((child) => child.text?.trim() ?? "")
        .join("")
        .trim()
    )
    .filter(Boolean);
}

export function blocksToPlainText(blocks: PortableTextBlock[] = []) {
  return blocksToParagraphs(blocks).join(" ");
}
