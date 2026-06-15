"use client";

import { Extension } from "@tiptap/core";

export const DragAndDrop = Extension.create({
  name: "dragAndDrop",

  addProseMirrorPlugins() {
    return [];
  },

  addGlobalAttributes() {
    return [
      {
        types: ["image"],
        attributes: {
          dataDragHandle: {
            default: "true",
            rendered: false,
          },
        },
      },
    ];
  },
});

export default DragAndDrop;