"use client";

import React from "react";
import CashFlowManager from "@/components/finance/cash-flow-manager";
import { Separator } from "@/components/ui/separator";

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Bendahara BOS</h3>
        <p className="text-sm text-muted-foreground">
          Pencatatan dana BOS berbasis kas, mutasi bank, dan Buku Kas Umum.
        </p>
      </div>
      <Separator />
      <CashFlowManager />
    </div>
  );
}

