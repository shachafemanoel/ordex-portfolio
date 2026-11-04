'use client';

import React from 'react';
import {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Archive,
  AlertTriangle,
  ArrowUpDown,
  Edit3,
  Globe,
  MoreHorizontal,
  Package2,
  ShoppingCart,
  Store,
  Copy,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { ProductRecord, ProcurementType, ProductStatus, SalesChannelKey } from '@/components/products/workspace/types';

interface ProductsTableProps {
  data: ProductRecord[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  onRowClick: (product: ProductRecord) => void;
  onUpdateStock: (productId: string, stock: number) => void;
  onUpdatePrice: (productId: string, price: number) => void;
  onArchive: (productId: string) => void;
  onDuplicate: (productId: string) => void;
}

const statusVariant: Record<ProductStatus, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'secondary',
};

const channelIcon: Record<SalesChannelKey, React.ComponentType<{ className?: string }>> = {
  ONLINE: Globe,
  OFFLINE: Store,
  WOOCOMMERCE: ShoppingCart,
};

const channelLabel: Record<SalesChannelKey, string> = {
  ONLINE: 'אונליין',
  OFFLINE: 'אופליין',
  WOOCOMMERCE: 'WooCommerce',
};

const procurementLabel: Record<ProcurementType, string> = {
  INVENTORY: 'מלאי מקומי',
  DROPSHIP: 'אספקה חיצונית',
  SPECIAL_ORDER: 'הזמנה מיוחדת',
};

function getStockClasses(stock: number, threshold: number): string {
  if (stock <= 0) return 'text-red-600';
  if (stock <= threshold) return 'text-amber-600';
  return 'text-emerald-600';
}

function formatSyncAgo(iso: string | null): string {
  if (!iso) return 'טרם סונכרן';
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'סונכרן לאחרונה';
  return `סונכרן לפני ${hours} ש׳`;
}

export function ProductsTable({
  data,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  onUpdateStock,
  onUpdatePrice,
  onArchive,
  onDuplicate,
}: ProductsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const [editingStockId, setEditingStockId] = React.useState<string | null>(null);
  const [stockDraft, setStockDraft] = React.useState(0);

  const [editingPriceId, setEditingPriceId] = React.useState<string | null>(null);
  const [priceDraft, setPriceDraft] = React.useState(0);

  const columns = React.useMemo<ColumnDef<ProductRecord>[]>(
    () => [
      {
        id: 'select',
        size: 42,
        header: ({ table }) => (
          <Checkbox
            aria-label="בחירת כל המוצרים"
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`בחירת ${row.original.name}`}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: 'thumbnail',
        header: '',
        cell: ({ row }) => (
          <div className="h-10 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            {row.original.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.original.imageUrl} alt={row.original.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Package2 className="h-4 w-4" />
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortButton label="מוצר" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        ),
        cell: ({ row }) => {
          const item = row.original;
          const isMissingSku = !item.sku.trim();
          const hasMissingImage = !item.imageUrl;

          return (
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">{item.sku || 'חסר מק״ט'}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
                {item.procurementType !== 'INVENTORY' && (
                  <Badge variant="info" className="text-[10px]">
                    {procurementLabel[item.procurementType]}
                  </Badge>
                )}
                {(isMissingSku || hasMissingImage) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {isMissingSku && hasMissingImage
                        ? 'חסרה תמונה וחסר מק״ט'
                        : isMissingSku
                        ? 'חסר מק״ט'
                        : 'חסרה תמונה'}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <SortButton label="סטטוס" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        ),
        cell: ({ row }) => (
          <Badge variant={statusVariant[row.original.status]}>
            {row.original.status === 'ACTIVE'
              ? 'פעיל'
              : row.original.status === 'DRAFT'
              ? 'טיוטה'
              : 'ארכיון'}
          </Badge>
        ),
      },
      {
        accessorKey: 'procurementType',
        header: ({ column }) => (
          <SortButton label="סוג אספקה" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        ),
        cell: ({ row }) => {
          const type = row.original.procurementType;
          return (
            <Badge variant={type === 'INVENTORY' ? 'success' : type === 'DROPSHIP' ? 'warning' : 'secondary'}>
              {procurementLabel[type]}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'stock',
        header: ({ column }) => (
          <SortButton label="מלאי" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        ),
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingStockId === item.id;
          const isExternalSupply = item.procurementType !== 'INVENTORY';

          if (isExternalSupply) {
            return <span className="text-xs font-semibold text-slate-500">לפי ספק</span>;
          }

          if (isEditing) {
            return (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button size="xs" variant="outline" onClick={() => setStockDraft((prev) => Math.max(0, prev - 1))}>
                  -
                </Button>
                <Input
                  type="number"
                  value={stockDraft}
                  onChange={(e) => setStockDraft(Number.parseInt(e.target.value || '0', 10))}
                  className="h-8 w-20"
                />
                <Button
                  size="xs"
                  onClick={() => {
                    onUpdateStock(item.id, Math.max(0, stockDraft));
                    setEditingStockId(null);
                  }}
                >
                  שמור
                </Button>
                <Button size="xs" variant="outline" onClick={() => setEditingStockId(null)}>
                  ביטול
                </Button>
              </div>
            );
          }

          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingStockId(item.id);
                setStockDraft(item.stock);
              }}
              className={`font-semibold ${getStockClasses(item.stock, item.lowStockThreshold)} focus:outline-none focus:ring-2 focus:ring-primary-400`}
              aria-label={`עריכת מלאי עבור ${item.name}`}
            >
              {item.stock}
              {item.stock <= item.lowStockThreshold && (
                <span className="ml-1 text-xs font-bold text-amber-600">מלאי נמוך</span>
              )}
            </button>
          );
        },
      },
      {
        accessorKey: 'price',
        header: ({ column }) => (
          <SortButton label="מחיר" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        ),
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingPriceId === item.id;

          if (isEditing) {
            return (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="number"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(Number.parseFloat(e.target.value || '0'))}
                  className="h-8 w-24"
                />
                <Button
                  size="xs"
                  onClick={() => {
                    onUpdatePrice(item.id, Math.max(0, priceDraft));
                    setEditingPriceId(null);
                  }}
                >
                  שמור
                </Button>
                <Button size="xs" variant="outline" onClick={() => setEditingPriceId(null)}>
                  ביטול
                </Button>
              </div>
            );
          }

          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingPriceId(item.id);
                setPriceDraft(item.price ?? 0);
              }}
              className="font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
              aria-label={`עריכת מחיר עבור ${item.name}`}
            >
              {item.price === null ? (
                <span className="text-amber-600">ללא מחיר</span>
              ) : (
                `${item.currency} ${item.price.toFixed(2)}`
              )}
            </button>
          );
        },
      },
      {
        id: 'channels',
        header: 'ערוצי מכירה',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.channels.map((channel) => {
              const Icon = channelIcon[channel.channel];
              return (
                <Tooltip key={channel.channel}>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                        channel.enabled ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      <span>{channelLabel[channel.channel]}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          channel.syncState === 'SYNCED'
                            ? 'bg-emerald-500'
                            : channel.syncState === 'PENDING'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <span>{formatSyncAgo(channel.lastSyncedAt)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ),
      },
      {
        id: 'meta',
        header: 'ספק / קטגוריה',
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="font-medium text-slate-800">{row.original.supplier}</p>
            <p className="text-xs text-slate-500">{row.original.category}</p>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" aria-label={`פעולות עבור ${row.original.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRowClick(row.original);
                }}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                עריכה
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(row.original.id);
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                שכפול
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(row.original.id);
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                ארכיון
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [editingPriceId, editingStockId, onArchive, onDuplicate, onRowClick, onUpdatePrice, onUpdateStock, priceDraft, stockDraft]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater(rowSelection)
          : updater;
      onRowSelectionChange(next);
    },
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table className="w-full border-spacing-0">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="border-b border-slate-200 bg-slate-50 shadow-none hover:translate-y-0 hover:shadow-none">
              {group.headers.map((header) => (
                <TableHead key={header.id} className="bg-slate-50">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="shadow-none hover:translate-y-0 hover:shadow-none">
              <TableCell colSpan={11} className="py-12 text-center text-slate-500">
                לא נמצאו מוצרים עבור הסינון שנבחר.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onRowClick(row.original)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onRowClick(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-500">
          מציג {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            data.length
          )}{' '}
          מתוך {data.length}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number.parseInt(value, 10))}
            options={[
              { label: '10 שורות', value: '10' },
              { label: '20 שורות', value: '20' },
              { label: '30 שורות', value: '30' },
            ]}
            className="h-8 w-28"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            הקודם
          </Button>
          <Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            הבא
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500" onClick={onClick}>
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}
