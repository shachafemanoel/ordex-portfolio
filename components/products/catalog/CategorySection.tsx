'use client';

import { ProductCardAdapter as ProductCard } from '@/components/products/ProductCardAdapter';
import { ProductRecord } from '@/components/products/workspace/types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Package } from 'lucide-react';
import { useState } from 'react';

interface CategorySectionProps {
  category: string;
  products: ProductRecord[];
}

export function CategorySection({ category, products }: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div
        className="flex items-center justify-between mb-4 cursor-pointer group select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary-50 p-2 rounded-lg text-primary-600 transition-colors group-hover:bg-primary-100">
            <Package className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 flex items-baseline gap-2">
            {category}
            <span className="text-sm font-normal text-gray-500">({products.length})</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-[1px] bg-gray-200 w-32 hidden sm:block"></div>
          <Button variant="ghost" size="sm" className="rounded-full w-8 h-8 p-0">
            <ChevronDown
              className={cn(
                'h-5 w-5 transition-transform duration-300',
                isOpen ? 'rotate-0' : 'rotate-180'
              )}
            />
          </Button>
        </div>
      </div>

      {/* Grid Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
