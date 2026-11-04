import { OpsStoreView } from '@/components/ops/OpsStoreView';

export const dynamic = 'force-dynamic';

export default function StorePage() {
  return (
    <div className="min-h-full pb-6 lg:pb-28">
      <OpsStoreView />
    </div>
  );
}
