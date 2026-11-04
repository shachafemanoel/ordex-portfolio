import { ProductCatalog } from '@/components/products/catalog/ProductCatalog';

export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  return (
    <div className="content-height overflow-hidden">
      <ProductCatalog />
    </div>
  );
}
