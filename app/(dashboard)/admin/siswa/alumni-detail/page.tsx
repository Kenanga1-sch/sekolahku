"use client";

import { Suspense } from 'react';
import ClientPage from './client-page';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center items-center">Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}


