"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Printer } from "lucide-react";

export interface PrintSettings {
    paperSize: "A4" | "Letter" | "Custom";
    paperWidth: number; // mm
    paperHeight: number; // mm
    labelWidth: number; // mm
    labelHeight: number; // mm
    columns: number;
    gapX: number; // mm
    gapY: number; // mm
    marginTop: number; // mm
    marginLeft: number; // mm
    fontSize: number; // pt
}

export const DEFAULT_SETTINGS: PrintSettings = {
    paperSize: "A4",
    paperWidth: 210,
    paperHeight: 297,
    labelWidth: 40,
    labelHeight: 40,
    columns: 4,
    gapX: 5,
    gapY: 5,
    marginTop: 10,
    marginLeft: 10,
    fontSize: 10,
};

interface PrintSettingsPanelProps {
    settings: PrintSettings;
    onSettingsChange: (settings: PrintSettings) => void;
}

export function PrintSettingsPanel({ settings, onSettingsChange }: PrintSettingsPanelProps) {
    const update = (key: keyof PrintSettings, value: any) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    return (
        <Card className="print:hidden h-fit">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="h-5 w-5" />
                    Pengaturan Cetak
                </CardTitle>
                <CardDescription>
                    Sesuaikan dengan kertas stiker Anda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Paper Size */}
                <div className="grid gap-2">
                    <Label>Ukuran Kertas</Label>
                    <Select
                        value={settings.paperSize}
                        onValueChange={(val: any) => {
                            if (val === "A4") update("paperSize", "A4");
                            if (val === "Letter") update("paperSize", "Letter");
                            if (val === "Custom") update("paperSize", "Custom");
                            
                            if (val === "A4") {
                                update("paperWidth", 210);
                                update("paperHeight", 297);
                            } else if (val === "Letter") {
                                update("paperWidth", 215.9);
                                update("paperHeight", 279.4);
                            }
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                            <SelectItem value="Letter">Letter (216 x 279 mm)</SelectItem>
                            <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Columns & Layout */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Lebar Label (mm)</Label>
                        <Input
                            type="number"
                            value={settings.labelWidth}
                            onChange={(e) => update("labelWidth", parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Tinggi Label (mm)</Label>
                        <Input
                            type="number"
                            value={settings.labelHeight}
                            onChange={(e) => update("labelHeight", parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Kolom</Label>
                        <Input
                            type="number"
                            value={settings.columns}
                            onChange={(e) => update("columns", parseInt(e.target.value) || 1)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Font Size (pt)</Label>
                        <Input
                            type="number"
                            value={settings.fontSize}
                            onChange={(e) => update("fontSize", parseFloat(e.target.value) || 0)}
                        />
                    </div>
                </div>

                {/* Margins & Gaps */}
                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Jarak & Margin</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs">Margin Atas (mm)</Label>
                            <Input
                                type="number"
                                value={settings.marginTop}
                                onChange={(e) => update("marginTop", parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Margin Kiri (mm)</Label>
                            <Input
                                type="number"
                                value={settings.marginLeft}
                                onChange={(e) => update("marginLeft", parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Gap Horizontal (mm)</Label>
                            <Input
                                type="number"
                                value={settings.gapX}
                                onChange={(e) => update("gapX", parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Gap Vertikal (mm)</Label>
                            <Input
                                type="number"
                                value={settings.gapY}
                                onChange={(e) => update("gapY", parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Helper to generate dynamic CSS
export function getPrintStyles(s: PrintSettings) {
    return `
        @media print {
            @page {
                size: ${s.paperSize === "Custom" ? `${s.paperWidth}mm ${s.paperHeight}mm` : s.paperSize};
                margin: 0;
            }
            body { 
                margin: 0; 
                padding: 0; 
                background: white;
            }
            .print-container {
                display: grid !important;
                grid-template-columns: repeat(${s.columns}, ${s.labelWidth}mm);
                grid-auto-rows: ${s.labelHeight}mm;
                column-gap: ${s.gapX}mm;
                row-gap: ${s.gapY}mm;
                padding-top: ${s.marginTop}mm;
                padding-left: ${s.marginLeft}mm;
                width: ${s.paperWidth}mm;
                box-sizing: border-box;
            }
            .qr-label {
                width: ${s.labelWidth}mm;
                height: ${s.labelHeight}mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border: 1px dotted #ccc; /* Optional: light border for guide */
                page-break-inside: avoid;
                overflow: hidden;
            }
            .qr-label img {
                width: 80% !important;
                height: auto !important;
            }
            .qr-text {
                font-size: ${s.fontSize}pt;
                font-family: monospace;
                margin-top: 2px;
            }
            
            /* Hide UI elements */
            .no-print, nav, header, aside, .print:hidden {
                display: none !important;
            }
        }
    `;
}
