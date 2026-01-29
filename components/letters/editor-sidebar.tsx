"use client";

import { Editor } from "@tiptap/react";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Variable,
  Search,
  School,
  Table as TableIcon,
  Plus,
  Trash2,
  Merge,
  Split,
  MoreVertical
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { LETTER_VARIABLES } from "@/lib/config/letter-variables";

interface EditorSidebarProps {
  editor: Editor | null;
  paperSize: string;
  setPaperSize: (v: string) => void;
  orientation: string;
  setOrientation: (v: string) => void;
  mode?: "EDITOR" | "UPLOAD";
}

import { useState, useEffect } from "react";

export function EditorSidebar({
  editor,
  paperSize,
  setPaperSize,
  orientation,
  setOrientation,
  mode = "EDITOR"
}: EditorSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("format");

  useEffect(() => {
    if (mode === "UPLOAD") setActiveTab("variables");
    else if (mode === "EDITOR" && activeTab === "variables") setActiveTab("format");
  }, [mode]);

  if (!editor && mode === "EDITOR") return null;

  const insertVariable = (val: string) => {
    if (mode === "EDITOR" && editor) {
        editor.chain().focus().insertContent(` ${val} `).run();
    } else {
        // Copy to clipboard if in upload mode
        navigator.clipboard.writeText(val);
        // Toast handled in onClick
    }
  };

  const insertKopSurat = () => {
      if (!editor) return;
      // Create a 2-column table for Kop Surat
      // Left: Logo, Right: School Info
      editor.chain().focus().insertContent({
          type: 'table',
          content: [
              {
                  type: 'tableRow',
                  content: [
                      {
                          type: 'tableCell',
                          attrs: { colSpan: 1, rowSpan: 1, colwidth: [80] },
                          content: [{ type: 'paragraph', content: [{ type: 'text', text: '[LOGO]' }] }]
                      },
                      {
                          type: 'tableCell',
                          attrs: { colSpan: 1, rowSpan: 1 },
                          content: [
                              { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'PEMERINTAH KABUPATEN INDRAMAYU' }] },
                              { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'DINAS PENDIDIKAN DAN KEBUDAYAAN' }] },
                              { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'UPTD SD NEGERI 1 KENANGA' }] },
                              { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Jl. Raya Kenanga No. 1 Kec. Sindang Kab. Indramayu 45226' }] },
                              { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Email: sdn1kenanga@gmail.com' }] },
                          ]
                      }
                  ]
              }
          ]
      }).run();
  };

  const FormatButton = ({ 
    active, 
    onClick, 
    icon: Icon, 
    label 
  }: { active: boolean; onClick: () => void; icon: any; label: string }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant={active ? "secondary" : "ghost"} 
            size="sm" 
            onClick={onClick}
            className="h-8 w-8 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="w-[320px] border-l bg-white dark:bg-zinc-900 flex flex-col h-full shrink-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 rounded-none border-b h-12 w-full shrink-0">
              <TabsTrigger value="format" disabled={mode === "UPLOAD"} className={mode === "UPLOAD" ? "hidden" : ""}>Formatting</TabsTrigger>
              <TabsTrigger value="variables" className={mode === "UPLOAD" ? "col-span-2" : ""}>Variabel Data</TabsTrigger>
          </TabsList>
          
          <TabsContent value="format" className="flex-1 p-4 space-y-6 overflow-y-auto min-h-0">
              {editor && (
                <>
                  {/* Paper Settings */}
                  <div className="space-y-4">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">Pengaturan Kertas</Label>
                      <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                              <span className="text-xs">Ukuran</span>
                              <Select value={paperSize} onValueChange={setPaperSize}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A4">A4 (210x297)</SelectItem>
                                    <SelectItem value="F4">F4 (215x330)</SelectItem>
                                    <SelectItem value="LEGAL">Legal (216x356)</SelectItem>
                                </SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-1">
                              <span className="text-xs">Orientasi</span>
                              <Select value={orientation} onValueChange={setOrientation}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="portrait">Potrait</SelectItem>
                                    <SelectItem value="landscape">Landscape</SelectItem>
                                </SelectContent>
                              </Select>
                          </div>
                      </div>
                  </div>

                  <Separator />

                  {/* Text Style */}
                  <div className="space-y-4">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">Text Style</Label>
                      <div className="flex flex-wrap gap-1 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-md border">
                          <FormatButton 
                            active={editor.isActive('bold')} 
                            onClick={() => editor.chain().focus().toggleBold().run()} 
                            icon={Bold} 
                            label="Bold" 
                          />
                          <FormatButton 
                            active={editor.isActive('italic')} 
                            onClick={() => editor.chain().focus().toggleItalic().run()} 
                            icon={Italic} 
                            label="Italic" 
                          />
                          <FormatButton 
                            active={editor.isActive('underline')} 
                            onClick={() => editor.chain().focus().toggleUnderline().run()} 
                            icon={UnderlineIcon} 
                            label="Underline" 
                          />
                      </div>
                      <div className="flex flex-wrap gap-1 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-md border">
                          <FormatButton 
                            active={editor.isActive({ textAlign: 'left' })} 
                            onClick={() => editor.chain().focus().setTextAlign('left').run()} 
                            icon={AlignLeft} 
                            label="Align Left" 
                          />
                          <FormatButton 
                            active={editor.isActive({ textAlign: 'center' })} 
                            onClick={() => editor.chain().focus().setTextAlign('center').run()} 
                            icon={AlignCenter} 
                            label="Align Center" 
                          />
                          <FormatButton 
                            active={editor.isActive({ textAlign: 'right' })} 
                            onClick={() => editor.chain().focus().setTextAlign('right').run()} 
                            icon={AlignRight} 
                            label="Align Right" 
                          />
                          <FormatButton 
                            active={editor.isActive({ textAlign: 'justify' })} 
                            onClick={() => editor.chain().focus().setTextAlign('justify').run()} 
                            icon={AlignJustify} 
                            label="Justify" 
                          />
                      </div>
                      <div className="flex flex-wrap gap-1 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-md border">
                          <FormatButton 
                            active={editor.isActive('bulletList')} 
                            onClick={() => editor.chain().focus().toggleBulletList().run()} 
                            icon={List} 
                            label="Bullet List" 
                          />
                          <FormatButton 
                            active={editor.isActive('orderedList')} 
                            onClick={() => editor.chain().focus().toggleOrderedList().run()} 
                            icon={ListOrdered} 
                            label="Ordered List" 
                          />
                      </div>
                  </div>
                  
                  <Separator />

                   <Separator />
                   
                   {/* Advanced Table Controls - Only visible when table is active */}
                   {editor.isActive('table') && (
                       <div className="space-y-4">
                           <Label className="text-xs uppercase text-blue-600 font-bold flex items-center gap-2">
                               <TableIcon className="h-3 w-3" /> Table Controls
                           </Label>
                           <div className="grid grid-cols-2 gap-2 bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100">
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addColumnBefore().run()} className="justify-start h-8 text-xs">
                                   <Plus className="h-3 w-3 mr-2" /> Col Left
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addColumnAfter().run()} className="justify-start h-8 text-xs">
                                   <Plus className="h-3 w-3 mr-2" /> Col Right
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addRowBefore().run()} className="justify-start h-8 text-xs">
                                   <Plus className="h-3 w-3 mr-2" /> Row Above
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addRowAfter().run()} className="justify-start h-8 text-xs">
                                   <Plus className="h-3 w-3 mr-2" /> Row Below
                               </Button>
                               <Separator className="col-span-2 my-1" />
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().mergeCells().run()} className="justify-start h-8 text-xs">
                                   <Merge className="h-3 w-3 mr-2" /> Merge
                               </Button>
                                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().splitCell().run()} className="justify-start h-8 text-xs">
                                   <Split className="h-3 w-3 mr-2" /> Split
                               </Button>
                               <Separator className="col-span-2 my-1" />
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteRow().run()} className="justify-start h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                                   <Trash2 className="h-3 w-3 mr-2" /> Del Row
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteColumn().run()} className="justify-start h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                                   <Trash2 className="h-3 w-3 mr-2" /> Del Col
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteTable().run()} className="col-span-2 justify-start h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                                   <Trash2 className="h-3 w-3 mr-2" /> Delete Table
                               </Button>
                           </div>
                       </div>
                   )}
    
                  <Separator />
                   
                  {/* Insert Objects */}
                  <div className="space-y-4">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">Insert</Label>
                       <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                          }}>
                              <TableIcon className="h-4 w-4 mr-2" /> Tabel
                          </Button>
                           <Button variant="outline" size="sm" onClick={() => {
                              const url = window.prompt('URL Gambar (Pastikan public URL):')
                              if (url) editor.chain().focus().setImage({ src: url }).run()
                          }}>
                              Gambar
                          </Button>
                          <Button variant="outline" size="sm" className="col-span-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700" onClick={insertKopSurat}>
                              <School className="h-4 w-4 mr-2" /> Insert Kop Surat
                          </Button>
                       </div>
                   </div>
                </>
              )}
          </TabsContent>

          {/* Variables Tab */}
           <TabsContent value="variables" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0">
              <div className="p-4 bg-white dark:bg-zinc-900 border-b space-y-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Cari variabel..." 
                            className="pl-9 bg-zinc-50 dark:bg-zinc-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-[10px] text-blue-800 dark:text-blue-200 border-b border-blue-100 dark:border-blue-900/30 text-center">
                  Klik variabel untuk menyisipkan.
              </div>
              <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                      {Object.entries(LETTER_VARIABLES).map(([group, items]) => {
                          const filteredItems = items.filter(i => 
                              i.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              i.value.toLowerCase().includes(searchTerm.toLowerCase())
                          );
                          
                          if (filteredItems.length === 0) return null;

                          return (
                              <div key={group} className="space-y-2">
                                  <h4 className="text-sm font-medium text-muted-foreground">{group}</h4>
                                  <div className="grid grid-cols-1 gap-2">
                                      {filteredItems.map((item) => (
                                          <Button 
                                            key={item.value} 
                                            variant="outline" 
                                            size="sm" 
                                            className="justify-start text-left h-auto py-2 group hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                                            onClick={() => {
                                                insertVariable(item.value);
                                                if (mode === "UPLOAD") {
                                                    import("sonner").then(({ toast }) => toast.success("Variable disalin ke clipboard"));
                                                }
                                            }}
                                          >
                                              <div className="flex items-center gap-2 w-full">
                                                  <div className="w-6 h-6 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 rounded shrink-0 transition-colors">
                                                     <Variable className="h-3 w-3 text-muted-foreground group-hover:text-blue-600" />
                                                  </div>
                                                  <div className="flex flex-col overflow-hidden">
                                                      <span className="truncate">{item.label}</span>
                                                      <code className="text-[10px] text-muted-foreground group-hover:text-blue-500">{item.value}</code>
                                                  </div>
                                              </div>
                                          </Button>
                                      ))}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </ScrollArea>
           </TabsContent>
      </Tabs>
    </div>
  );
}
