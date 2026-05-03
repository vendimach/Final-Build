import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Save, X, BoxSelect } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

export const Route = createFileRoute("/admin/bundles")({
  component: AdminBundles,
});

interface BundleProduct {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  stock: number;
}

const EMPTY_DRAFT = {
  name: "",
  price: "",
  description: "",
  image_url: "",
  stock: "100",
  is_active: true,
};

function AdminBundles() {
  const [bundles, setBundles] = useState<BundleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, description, image_url, is_active, stock")
      .eq("format", "bundles")
      .order("created_at", { ascending: false });
    setBundles((data ?? []) as BundleProduct[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(b: BundleProduct) {
    setDraft({
      name: b.name,
      price: String(b.price),
      description: b.description ?? "",
      image_url: b.image_url ?? "",
      stock: String(b.stock),
      is_active: b.is_active,
    });
    setEditingId(b.id);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function save() {
    const price = Number(draft.price);
    if (!draft.name.trim()) { toast.error("Name is required"); return; }
    if (!Number.isFinite(price) || price <= 0) { toast.error("Enter a valid price"); return; }

    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        price,
        description: draft.description.trim() || null,
        image_url: draft.image_url.trim() || null,
        stock: Math.max(0, Number(draft.stock) || 0),
        is_active: draft.is_active,
        format: "bundles" as const,
        // Required non-null fields with sensible defaults for bundles
        flavor: "savory" as const,
        spice_level: 0,
        sweetness_level: 0,
        dietary_tags: [] as string[],
        slug: `bundle-${Date.now()}`,
      };

      if (editingId) {
        const { error } = await supabase
          .from("products")
          .update({
            name: payload.name,
            price: payload.price,
            description: payload.description,
            image_url: payload.image_url,
            stock: payload.stock,
            is_active: payload.is_active,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Bundle updated");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Bundle created");
      }

      cancelForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save bundle");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBundle(id: string) {
    if (!confirm("Delete this bundle?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Bundle deleted");
    setBundles((b) => b.filter((x) => x.id !== id));
  }

  async function toggleActive(b: BundleProduct) {
    const { error } = await supabase.from("products").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    setBundles((prev) => prev.map((x) => x.id === b.id ? { ...x, is_active: !b.is_active } : x));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Pre-Made Bundles</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Bundles appear on the Build-a-Box page under "Pre-Made Bundles".</p>
        </div>
        {!showForm && (
          <button onClick={openCreate} className="btn-glow inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
            <Plus className="h-4 w-4" /> New Bundle
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="mb-8 rounded-2xl border border-primary/30 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl">{editingId ? "Edit Bundle" : "Create Bundle"}</h3>
            <button onClick={cancelForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label-text">Bundle name *</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Pitmaster's Choice — 12 Pack"
                className="field mt-1"
              />
            </label>
            <label className="block">
              <span className="label-text">Price (₹) *</span>
              <input
                type="number"
                min="1"
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                placeholder="4499"
                className="field mt-1"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label-text">What's in the bundle</span>
              <textarea
                rows={4}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder={"2× Smoky Chipotle Sticks\n2× Classic BBQ Strips\n2× Teriyaki Bites\n2× Honey Sriracha Jerky\n4× Pitmasters Select Sampler"}
                className="field mt-1"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Each line is one item entry. Shown to customers on the Build-a-Box page.</p>
            </label>
            <label className="block sm:col-span-2">
              <span className="label-text">Image URL</span>
              <input
                value={draft.image_url}
                onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
                placeholder="https://..."
                className="field mt-1"
              />
            </label>
            <label className="block">
              <span className="label-text">Stock quantity</span>
              <input
                type="number"
                min="0"
                value={draft.stock}
                onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                className="field mt-1"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium">Active (visible to customers)</span>
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="btn-glow inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Update Bundle" : "Create Bundle"}
            </button>
            <button onClick={cancelForm} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {/* Bundle list */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : bundles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <BoxSelect className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No bundles yet. Click "New Bundle" to create your first pre-made bundle.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => (
            <div key={b.id} className={`rounded-2xl border bg-card overflow-hidden ${b.is_active ? "border-border" : "border-border opacity-60"}`}>
              {b.image_url && (
                <img src={b.image_url} alt={b.name} className="h-40 w-full object-cover" />
              )}
              {!b.image_url && (
                <div className="flex h-40 w-full items-center justify-center bg-muted">
                  <BoxSelect className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight">{b.name}</h3>
                    <div className="mt-0.5 font-display text-lg text-primary">{formatINR(b.price)}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${b.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {b.is_active ? "Active" : "Hidden"}
                  </span>
                </div>
                {b.description && (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted-foreground line-clamp-4">{b.description}</pre>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openEdit(b)} className="flex-1 rounded-xl border border-border bg-background py-1.5 text-xs font-semibold">Edit</button>
                  <button onClick={() => toggleActive(b)} className="flex-1 rounded-xl border border-border bg-background py-1.5 text-xs font-semibold">
                    {b.is_active ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => deleteBundle(b.id)} className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .label-text { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: hsl(var(--muted-foreground)); }
        .field { width: 100%; border-radius: 0.75rem; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 0.625rem 0.75rem; font-size: 0.875rem; outline: none; }
        .field:focus { border-color: hsl(var(--primary)); }
      `}</style>
    </div>
  );
}
