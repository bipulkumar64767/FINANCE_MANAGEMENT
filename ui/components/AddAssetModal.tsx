import { useState, useEffect } from 'react';
import { X, Plus, Package } from 'lucide-react';
import { createAsset, getAssetCategories } from '../lib/api';
import { Card, Button, Input, Select, Spinner } from './ui';
import type { AssetCategory } from '../types';

interface AddAssetModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddAssetModal({ open, onClose, onSuccess }: AddAssetModalProps) {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [financeMin, setFinanceMin] = useState<number>(0);
  const [financeMax, setFinanceMax] = useState<number>(0);
  const [interestRate, setInterestRate] = useState<number>(12);
  const [maxTenure, setMaxTenure] = useState<number>(24);
  const [imageUrl, setImageUrl] = useState('');

  // Fetch categories on mount
  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      try {
        const data = await getAssetCategories();
        setCategories(data || []);
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Update finance max when price changes
  useEffect(() => {
    if (price > 0) {
      setFinanceMax(price);
      setFinanceMin(Math.floor(price * 0.5));
    }
  }, [price]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name || !brand || price <= 0) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await createAsset({
        category_id: categoryId || undefined,
        name,
        brand,
        model: model || undefined,
        description: description || undefined,
        price,
        finance_min: financeMin,
        finance_max: financeMax,
        interest_rate: interestRate,
        max_tenure_months: maxTenure,
        image_url: imageUrl || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add asset');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCategoryId('');
    setName('');
    setBrand('');
    setModel('');
    setDescription('');
    setPrice(0);
    setFinanceMin(0);
    setFinanceMax(0);
    setInterestRate(12);
    setMaxTenure(24);
    setImageUrl('');
    setError(null);
    setSuccess(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add New Asset</h2>
              <p className="text-xs text-slate-500">List a new asset for financing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {success && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs">✓</div>
              <p>Asset added successfully!</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white text-xs">!</div>
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="w-8 h-8" />
            </div>
          ) : (
            <>
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Asset Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Motorcycle, Car, Laptop"
                    required
                  />
                  <Input
                    label="Brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., Honda, Toyota, Apple"
                    required
                  />
                  <Input
                    label="Model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Optional model number"
                  />
                  <Select
                    label="Category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the asset"
                  as="textarea"
                />
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Pricing & Finance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Asset Price"
                    type="number"
                    value={price || ''}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    placeholder="0"
                    min={0}
                    step={1000}
                    required
                  />
                  <Input
                    label="Interest Rate (% p.a.)"
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    min={0}
                    max={100}
                    step={0.5}
                  />
                  <Input
                    label="Min Finance Amount"
                    type="number"
                    value={financeMin || ''}
                    onChange={(e) => setFinanceMin(Number(e.target.value))}
                    min={0}
                    step={1000}
                  />
                  <Input
                    label="Max Finance Amount"
                    type="number"
                    value={financeMax || ''}
                    onChange={(e) => setFinanceMax(Number(e.target.value))}
                    min={financeMin}
                    step={1000}
                  />
                  <Input
                    label="Max Tenure (months)"
                    type="number"
                    value={maxTenure}
                    onChange={(e) => setMaxTenure(Number(e.target.value))}
                    min={1}
                    max={60}
                  />
                </div>
              </div>

              {/* Media */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Media</h3>
                <Input
                  label="Image URL"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-900 font-medium transition-colors disabled:bg-slate-50 disabled:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-r-transparent animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Asset
                </>
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
