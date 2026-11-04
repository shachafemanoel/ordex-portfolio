'use client';

import apiClient from '@/lib/apiClient';

/**
 * Advanced Filters Component
 * Smart filtering with saved searches and presets
 */

import { useState, useEffect } from 'react';
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  XMarkIcon,
  // PlusIcon, // Reserved for adding new filters
  TrashIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/Button';
import {
  CANONICAL_STATUS_OPTIONS,
  CanonicalOrderStatus,
  getCanonicalStatusColor,
} from '@/lib/orderStatus';

export interface FilterConfig {
  status?: CanonicalOrderStatus[];
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  customerName?: string;
  city?: string;
  assignedUser?: string;
  priority?: boolean;
  hasInstallDate?: boolean;
  tags?: string[];
}

export interface SavedFilter {
  id: string;
  name: string;
  config: FilterConfig;
  createdAt: Date;
}

interface AdvancedFiltersProps {
  onFilterChange: (config: FilterConfig) => void;
  initialConfig?: FilterConfig;
}

export function AdvancedFilters({ onFilterChange, initialConfig = {} }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<FilterConfig>(initialConfig);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const statuses = CANONICAL_STATUS_OPTIONS;

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const loadSavedFilters = async () => {
    try {
      const response = await apiClient('/api/filters/saved');
      if (response.ok) {
        const data = await response.json();
        setSavedFilters(data.filters || []);
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    }
  };

  const handleStatusToggle = (status: CanonicalOrderStatus) => {
    setConfig((prev) => {
      const statuses = prev.status || [];
      const newStatuses = statuses.includes(status)
        ? statuses.filter((s) => s !== status)
        : [...statuses, status];
      return { ...prev, status: newStatuses.length > 0 ? newStatuses : undefined };
    });
  };

  const handleApply = () => {
    onFilterChange(config);
    setIsOpen(false);
  };

  const handleReset = () => {
    setConfig({});
    onFilterChange({});
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;

    try {
      const response = await apiClient('/api/filters/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName, config }),
      });

      if (response.ok) {
        await loadSavedFilters();
        setSaveName('');
        setShowSaveDialog(false);
      }
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  };

  const handleLoadFilter = (filter: SavedFilter) => {
    setConfig(filter.config);
    onFilterChange(filter.config);
    setIsOpen(false);
  };

  const handleDeleteFilter = async (id: string) => {
    if (!confirm('האם למחוק את הסינון השמור?')) return;

    try {
      await apiClient(`/api/filters/saved/${id}`, { method: 'DELETE' });
      await loadSavedFilters();
    } catch (error) {
      console.error('Failed to delete filter:', error);
    }
  };

  const activeFilterCount = Object.keys(config).filter(
    (key) => config[key as keyof FilterConfig] !== undefined
  ).length;

  return (
    <div className="relative">
      {/* Filter Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="relative"
      >
        <FunnelIcon className="h-5 w-5 ml-2" />
        סינון מתקדם
        {activeFilterCount > 0 && (
          <span className="absolute -top-2 -left-2 h-5 w-5 flex items-center justify-center text-xs font-bold text-on-dark bg-blue-600 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </Button>

      {/* Filter Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
            <h3 className="text-lg font-semibold text-gray-900">סינון מתקדם</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="סגור"
            >
              <XMarkIcon className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BookmarkSolidIcon className="h-4 w-4 text-blue-600" />
                  סינונים שמורים
                </h4>
                <div className="space-y-2">
                  {savedFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <button
                        onClick={() => handleLoadFilter(filter)}
                        className="flex-1 text-right text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {filter.name}
                      </button>
                      <button
                        onClick={() => handleDeleteFilter(filter.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                        aria-label="מחק"
                      >
                        <TrashIcon className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Filter */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">סטטוס</h4>
              <div className="grid grid-cols-3 gap-2">
                {statuses.map((status) => {
                  const isSelected = config.status?.includes(status.value);
                  const colorClass = getCanonicalStatusColor(status.value);
                  return (
                    <button
                      key={status.value}
                      onClick={() => handleStatusToggle(status.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? `${colorClass} border-2 border-transparent`
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                      }`}
                    >
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">טווח תאריכים</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">מתאריך</label>
                  <input
                    type="date"
                    value={config.dateFrom || ''}
                    onChange={(e) => setConfig({ ...config, dateFrom: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">עד תאריך</label>
                  <input
                    type="date"
                    value={config.dateTo || ''}
                    onChange={(e) => setConfig({ ...config, dateTo: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Amount Range */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">טווח סכום</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">מינימום</label>
                  <input
                    type="number"
                    value={config.amountMin || ''}
                    onChange={(e) => setConfig({ ...config, amountMin: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">מקסימום</label>
                  <input
                    type="number"
                    value={config.amountMax || ''}
                    onChange={(e) => setConfig({ ...config, amountMax: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="∞"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Text Filters */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">שם לקוח</label>
                <input
                  type="text"
                  value={config.customerName || ''}
                  onChange={(e) => setConfig({ ...config, customerName: e.target.value || undefined })}
                  placeholder="חיפוש לפי שם לקוח..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">עיר</label>
                <input
                  type="text"
                  value={config.city || ''}
                  onChange={(e) => setConfig({ ...config, city: e.target.value || undefined })}
                  placeholder="חיפוש לפי עיר..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Boolean Filters */}
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.priority || false}
                  onChange={(e) => setConfig({ ...config, priority: e.target.checked || undefined })}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">עדיפות גבוהה בלבד</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.hasInstallDate || false}
                  onChange={(e) => setConfig({ ...config, hasInstallDate: e.target.checked || undefined })}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">עם תאריך התקנה</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 p-4 border-t border-gray-200 bg-gray-50 sticky bottom-0">
            <Button onClick={handleReset} variant="outline" className="flex-1">
              איפוס
            </Button>
            <Button
              onClick={() => setShowSaveDialog(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <BookmarkIcon className="h-4 w-4" />
              שמור
            </Button>
            <Button onClick={handleApply} className="flex-1">
              החל סינון
            </Button>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">שמירת סינון</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="שם הסינון..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveName('');
                }}
                variant="outline"
                className="flex-1"
              >
                ביטול
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={!saveName.trim()}>
                שמור
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick Search Component
interface QuickSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function QuickSearch({ onSearch, placeholder = 'חיפוש מהיר...' }: QuickSearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <div className="relative">
      <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
      />
      {query && (
        <button
          onClick={() => handleSearch('')}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="נקה"
        >
          <XMarkIcon className="h-4 w-4 text-gray-400" />
        </button>
      )}
    </div>
  );
}
