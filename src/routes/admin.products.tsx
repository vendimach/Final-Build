import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Plus, Trash2, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { DbProduct } from "@/lib/db-products";
import { formatINR } from "@/lib/currency";

const MAX_PHOTOS = 8;

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

type EditingProduct = Partial<DbProduct> & { gallery_urls?: string[] };

function AdminProducts() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data ?? []) as DbProduct[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const photos: string[] = editing?.gallery_urls && editing.gallery_urls.length > 0
    ? editing.gallery_urls
    : (editing?.image_url ? [editing.image_url] : []);

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0 || !editing) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`Up to ${MAX_PHOTOS} photos allowed`);
      return;
    }
    const incoming = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`Only added ${remaining} more (limit ${MAX_PHOTOS})`);
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of incoming) {
        if (!file.type.startsWith("image/")) {
          toast.error("Only image files");
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const slugPart = (editing.slug || "new") + "-" + crypto.randomUUID();
        const path = `${slugPart}.${ext}`;
        const { error } = await supabase.storage.from("product-photos").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
        if (data?.publicUrl) uploaded.push(data.publicUrl);
      }
      if (uploaded.length > 0) {
        const next = [...photos, ...uploaded].slice(0, MAX_PHOTOS);
        setEditing({
          ...editing,
          gallery_urls: next,
          image_url: editing.image_url ?? next[0],
          hover_image_url: editing.hover_image_url ?? next[1] ?? next[0],
        });
        toast.success(`${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(url: string) {
    if (!editing) return;
    const next = photos.filter((u) => u !== url);
    setEditing({
      ...editing,
      gallery_urls: next,
      image_url: editing.image_url === url ? (next[0] ?? null) : editing.image_url,
      hover_image_url: editing.hover_image_url === url ? (next[1] ?? next[0] ?? null) : editing.hover_image_url,
    });
  }

  function setAsCover(url: string) {
    if (!editing) return;
    setEditing({ ...editing, image_url: url });
  }

  async function save() {
    if (!editing?.name || !editing?.slug || editing?.price === undefined) {
      toast.error("Name, slug, and price required");
      return;
    }
    const gallery = editing.gallery_urls ?? (editing.image_url ? [editing.image_url] : []);
    const payload = {
      name: editing.name,
      slug: editing.slug,
      description: editing.description ?? null,
      price: editing.price,
      compare_at_price: editing.compare_at_price ?? null,
      format: editing.format ?? "bags",
      flavor: editing.flavor ?? "savory",
      spice_level: editing.spice_level ?? 0,
      sweetness_level: editing.sweetness_level ?? 0,
      stock: editing.stock ?? 0,
      image_url: editing.image_url ?? gallery[0] ?? null,
      hover_image_url: editing.hover_image_url ?? gallery[1] ?? gallery[0] ?? null,
      gallery_urls: gallery,
      is_active: editing.is_active ?? true,
      is_featured: editing.is_featured ?? false,
    };
    const op = editing.id
      ? supabase.from("products").update(payload).eq("id", editing.id)
      : supabase.from("products").insert(payload);
    const { error } = await op;
    if (error) toast.error(error.message);
    else { toast.success("Saved"); setEditing(null); load(); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl tracking-wide">Products</h2>
        <button onClick={() => setEditing({ gallery_urls: [] })} className="btn-glow inline-flex items-center gap-1 rounded-full bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{p.name}</h3>
                <p className="font-mono text-[10px] text-muted-foreground">{p.slug}</p>
              </div>
              <div className="text-right">
                <div className="font-display">{formatINR(Number(p.price))}</div>
                <div className="text-[10px] text-muted-foreground">stock: {p.stock}</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
              <span className="rounded bg-muted px-1.5 py-0.5">{p.flavor}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{p.format}</span>
              {(p.gallery_urls?.length ?? 0) > 0 && (
                <span className="rounded bg-muted px-1.5 py-0.5">{p.gallery_urls!.length} photo{p.gallery_urls!.length > 1 ? "s" : ""}</span>
              )}
              {p.is_active ? <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">active</span> : <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive">inactive</span>}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing({ ...p, gallery_urls: p.gallery_urls ?? (p.image_url ? [p.image_url] : []) })} className="flex-1 rounded-full border border-border bg-background py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-muted">Edit</button>
              <button onClick={() => remove(p.id)} className="rounded-full border border-destructive/40 px-2 py-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-3xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl">{editing.id ? "Edit" : "New"} Product</h3>

            {/* Photos */}
            <Field label={`Photos (${photos.length}/${MAX_PHOTOS})`}>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((url) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {editing.image_url === url && (
                      <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary-foreground">Cover</span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      {editing.image_url !== url && (
                        <button type="button" onClick={() => setAsCover(url)} className="rounded-full bg-primary px-2 py-1 text-[9px] font-bold uppercase text-primary-foreground" title="Set as cover">
                          <ImageIcon className="h-3 w-3" />
                        </button>
                      )}
                      <button type="button" onClick={() => removePhoto(url)} className="rounded-full bg-destructive px-2 py-1 text-[9px] font-bold uppercase text-destructive-foreground" title="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span className="text-[9px] font-bold uppercase">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => uploadPhotos(e.target.files)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Upload up to {MAX_PHOTOS} photos. The cover appears on cards and PDP first.</p>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name *"><input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" /></Field>
              <Field label="Slug *"><input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="input" /></Field>
              <Field label="Price *"><input type="number" step="0.01" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) })} className="input" /></Field>
              <Field label="Compare at"><input type="number" step="0.01" value={editing.compare_at_price ?? ""} onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value ? parseFloat(e.target.value) : null })} className="input" /></Field>
              <Field label="Stock"><input type="number" value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: parseInt(e.target.value) })} className="input" /></Field>
              <Field label="Image URL (optional override)"><input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="input" /></Field>
              <Field label="Flavor">
                <select value={editing.flavor ?? "savory"} onChange={(e) => setEditing({ ...editing, flavor: e.target.value as DbProduct["flavor"] })} className="input">
                  <option value="spicy">Spicy</option><option value="sweet">Sweet</option><option value="savory">Savory</option>
                </select>
              </Field>
              <Field label="Format">
                <select value={editing.format ?? "bags"} onChange={(e) => setEditing({ ...editing, format: e.target.value as DbProduct["format"] })} className="input">
                  <option value="bags">Bags</option><option value="sticks">Sticks</option><option value="bundles">Bundles</option>
                </select>
              </Field>
              <Field label="Spice 0–5"><input type="number" min={0} max={5} value={editing.spice_level ?? 0} onChange={(e) => setEditing({ ...editing, spice_level: parseInt(e.target.value) })} className="input" /></Field>
              <Field label="Sweet 0–5"><input type="number" min={0} max={5} value={editing.sweetness_level ?? 0} onChange={(e) => setEditing({ ...editing, sweetness_level: parseInt(e.target.value) })} className="input" /></Field>
            </div>
            <Field label="Description"><textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className="input" /></Field>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_featured ?? false} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Featured</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider">Cancel</button>
              <button onClick={save} className="btn-glow inline-flex items-center gap-1 rounded-full bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground"><Save className="h-3 w-3" /> Save</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input { width: 100%; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); color: hsl(var(--foreground)); padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; } .input:focus { outline: none; border-color: hsl(var(--primary)); }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
