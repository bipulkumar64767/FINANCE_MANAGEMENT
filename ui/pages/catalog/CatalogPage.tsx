import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Package, Plus, Tag, Percent, Wallet, ArrowRight, ImageOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAssets, getAssetCategories } from '../../lib/api';
import { Button, Card, Badge, EmptyState, Spinner } from '../../components/ui';
import { AddAssetModal } from '../../components/AddAssetModal';
import { formatCurrency } from '../../lib/utils';
import type { Asset, AssetCategory } from '../../types';

export default function CatalogPage() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);

  const canAddAsset = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'RETAILER';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsData, categoriesData] = await Promise.all([
        getAssets('AVAILABLE'),
        getAssetCategories(),
      ]);

      setAssets((assetsData as unknown as Asset[]) || []);
      setCategories((categoriesData as AssetCategory[]) || []);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesCategory =
        activeCategory === 'all' || asset.category_id === activeCategory;
      const matchesSearch =
        !query ||
        asset.name.toLowerCase().includes(query) ||
        asset.brand.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [assets, activeCategory, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asset Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse assets available for financing and apply for a loan in minutes.
          </p>
        </div>
        {canAddAsset && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddAssetModal(true)}>
            Add Asset
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or brand..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <CategoryButton
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          label="All"
          count={assets.length}
        />
        {categories.map((category) => {
          const count = assets.filter((a) => a.category_id === category.id).length;
          return (
            <CategoryButton
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              label={category.name}
              count={count}
            />
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner className="w-8 h-8" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Package className="w-7 h-7" />}
            title={search || activeCategory !== 'all' ? 'No assets found' : 'No assets available'}
            description={
              search || activeCategory !== 'all'
                ? 'Try adjusting your search or category filters.'
                : 'There are no assets in the catalog yet. Please check back later.'
            }
            action={
              search || activeCategory !== 'all' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setActiveCategory('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{filteredAssets.length}</span>{' '}
            {filteredAssets.length === 1 ? 'asset' : 'assets'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </>
      )}

      {/* Add Asset Modal */}
      <AddAssetModal
        open={showAddAssetModal}
        onClose={() => setShowAddAssetModal(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-slate-900 text-white shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <Tag className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
      {label}
      <span
        className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs ${
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const financeMin = asset.finance_min ?? asset.price;
  const financeMax = asset.finance_max ?? asset.price;

  return (
    <Link
      to={`/catalog/${asset.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 rounded-2xl"
    >
      <Card className="overflow-hidden h-full flex flex-col transition-all duration-200 group-hover:shadow-md group-hover:border-slate-300">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {asset.image_url ? (
            <img
              src={asset.image_url}
              alt={asset.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
              <ImageOff className="w-8 h-8 mb-1" />
              <span className="text-xs">No image</span>
            </div>
          )}
          <div className="absolute top-3 right-3">
            <Badge className="bg-white/90 backdrop-blur text-slate-700 border border-slate-200 px-2.5 py-1 shadow-sm">
              <Percent className="w-3 h-3 mr-1" />
              {asset.interest_rate}% p.a.
            </Badge>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {asset.category && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {asset.category.name}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 leading-snug group-hover:text-slate-700 transition-colors">
            {asset.name}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">{asset.brand}</p>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-400">Price</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(asset.price)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                <Wallet className="w-3 h-3" /> Finance range
              </p>
              <p className="text-xs font-medium text-slate-600">
                {formatCurrency(financeMin)} – {formatCurrency(financeMax)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
            View details
            <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
