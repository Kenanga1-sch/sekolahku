/**
 * letter-pdf-rich.tsx — Renderer rich text (TipTap JSON → React-PDF).
 *
 * Diekstrak dari letter-pdf.tsx (refactor, zero behavior change).
 */
import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { substitute } from "@/lib/letter-render-shared";
import { parseRichText, type RichNode } from "@/lib/letter-richtext";
import type { LetterSchoolData } from "./letter-pdf-types";
import type { LetterStandard } from "@/lib/config/letter-standards";
import type { buildStyles } from "./letter-pdf-styles";

export interface BlockRenderCtx {
  styles: ReturnType<typeof buildStyles>;
  school: LetterSchoolData;
  vars: Record<string, string>;
  standard: LetterStandard;
}

export function richInline(node: RichNode, key: number): React.ReactNode {
  const style: Style = {};
  const marks = node.marks || [];
  for (const m of marks) {
    if (m.type === "bold") style.fontWeight = "bold";
    if (m.type === "italic") style.fontStyle = "italic";
    if (m.type === "underline") style.textDecoration = "underline";
    if (m.type === "strike") style.textDecoration = "line-through";
  }
  return (
    <Text key={key} style={style}>
      {node.text || ""}
    </Text>
  );
}

/**
 * Render rich text (JSON TipTap) menjadi beberapa elemen React-PDF.
 * Mendukung paragraf, bullet/list berurutan, dan inline marks dasar.
 */
export function renderRich(
  json: string,
  ctx: BlockRenderCtx,
  keyBase: string
): React.ReactElement | null {
  const doc = parseRichText(json);
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) return null;
  const { styles } = ctx;
  const out: React.ReactNode[] = [];
  let listCounter = 0;

  doc.content.forEach((node, i) => {
    const type = node.type;
    if (type === "paragraph") {
      const text = renderInlineChildren(node.content, ctx, `${keyBase}-p${i}`);
      out.push(
        <Text style={styles.paragraf} key={`${keyBase}-p${i}`}>
          {text}
        </Text>
      );
      listCounter = 0;
    } else if (type === "bulletList" || type === "orderedList") {
      const items = (node.content || []).filter((c) => c.type === "listItem");
      items.forEach((li, liIdx) => {
        const para = (li.content || []).find((c) => c.type === "paragraph");
        const text = renderInlineChildren(para?.content, ctx, `${keyBase}-li${i}-${liIdx}`);
        const marker = type === "orderedList" ? `${++listCounter}.` : "•";
        out.push(
          <View style={styles.listRow} key={`${keyBase}-li${i}-${liIdx}`}>
            <Text style={styles.listBullet}>{marker}</Text>
            <Text style={styles.listText}>{text}</Text>
          </View>
        );
      });
    } else if (type === "heading") {
      out.push(
        <Text
          style={[styles.paragraf, { fontWeight: "bold" }]}
          key={`${keyBase}-h${i}`}
        >
          {renderInlineChildren(node.content, ctx, `${keyBase}-h${i}`)}
        </Text>
      );
    }
  });

  if (out.length === 0) return null;
  return <View key={keyBase}>{out}</View>;
}

export function renderInlineChildren(
  content: RichNode[] | undefined,
  ctx: BlockRenderCtx,
  keyBase: string
): React.ReactNode[] {
  if (!content || content.length === 0) return [];
  return content.map((n, i) => {
    if (n.type === "text") {
      const sub = substitute(n.text || "", ctx.vars);
      return richInline({ ...n, text: sub }, i);
    }
    if (n.type === "hardBreak") return <Text key={`${keyBase}-br${i}`}>{"\n"}</Text>;
    return null;
  });
}
