'use client';

import { useEffect, useState } from 'react';
import FormulaVisualizer from '@/components/formula/FormulaVisualizer';
import { DBService } from '@/lib/storage';
import type { UserFormula } from '@/types/formula';

export default function FormulaPage() {
  const [formula, setFormula] = useState<UserFormula | null>(null);

  function refreshFormula() {
    setFormula(DBService.getFormula());
  }

  useEffect(() => {
    refreshFormula();
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Taste Formula</h1>
      <p className="text-muted-foreground">
        Review and adjust the factors used to personalize your movie recommendations.
      </p>
      <FormulaVisualizer formula={formula} onUpdate={refreshFormula} />
    </section>
  );
}
