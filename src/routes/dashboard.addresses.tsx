import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { INDIAN_STATES } from "@/lib/currency";

export const Route = createFileRoute("/dashboard/addresses")({
  component: DashboardAddresses,
});

interface SavedAddress {
  id: string;
  label: string | null;
  recipient: string;
  street1: string;
  street2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  phone: string | null;
  is_default: boolean;
}

const EMPTY_DRAFT = {
  label: "", recipient: "", street1: "", street2: "", city: "",
  region: "Maharashtra", postal_code: "", phone: "", is_default: false,
};

function DashboardAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<SavedAddress | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("addresses")
      .select("id, label, recipient, street1, street2, city, region, postal_code, phone, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => { setAddresses((data ?? []) as SavedAddress[]); setLoading(false); });
  }, [user]);

  function openAdd() {
    setEditingAddr(null);
    setDraft({ ...EMPTY_DRAFT, is_default: addresses.length === 0 });
    setFormOpen(true);
  }

  function openEdit(addr: SavedAddress) {
    setEditingAddr(addr);
    setDraft({
      label: addr.label ?? "",
      recipient: addr.recipient,
      street1: addr.street1,
      street2: addr.street2 ?? "",
      city: addr.city,
      region: addr.region ?? "Maharashtra",
      postal_code: addr.postal_code,
      phone: addr.phone ?? "",
      is_default: addr.is_default,
    });
    setFormOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!draft.recipient || !draft.street1 || !draft.city || !draft.postal_code) {
      toast.error("Recipient, address, city and PIN are required");
      return;
    }
    setSaving(true);
    try {
      if (editingAddr) {
        const { error } = await supabase
          .from("addresses")
          .update({ ...draft, updated_at: new Date().toISOString() })
          .eq("id", editingAddr.id);
        if (error) throw error;
        setAddresses((prev) => prev.map((a) => a.id === editingAddr.id ? { ...a, ...draft } : a));
      } else {
        if (addresses.length >= 4) { toast.error("Maximum 4 addresses allowed"); return; }
        const { data, error } = await supabase
          .from("addresses")
          .insert({ ...draft, user_id: user.id, country: "IN" })
          .select()
          .single();
        if (error) throw error;
        setAddresses((prev) => [...prev, data as SavedAddress]);
      }
      toast.success(editingAddr ? "Address updated" : "Address saved");
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save address");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    toast.success("Address removed");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
          <MapPin className="h-5 w-5 text-primary" /> Saved Addresses
        </h2>
        {!formOpen && (
          <button
            onClick={openAdd}
            disabled={addresses.length >= 4}
            className="btn-glow inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {addresses.length >= 4 ? "Limit reached" : "Add Address"}
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {formOpen && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{editingAddr ? "Edit Address" : "New Address"}</h3>
            <button onClick={() => setFormOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Label (optional)">
              <input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Home, Office…" className="addr-input" />
            </Field>
            <Field label="Recipient *">
              <input value={draft.recipient} onChange={(e) => setDraft((d) => ({ ...d, recipient: e.target.value }))} placeholder="Full name" className="addr-input" />
            </Field>
            <Field label="Street line 1 *" className="sm:col-span-2">
              <input value={draft.street1} onChange={(e) => setDraft((d) => ({ ...d, street1: e.target.value }))} placeholder="House / flat / building" className="addr-input" />
            </Field>
            <Field label="Street line 2" className="sm:col-span-2">
              <input value={draft.street2} onChange={(e) => setDraft((d) => ({ ...d, street2: e.target.value }))} placeholder="Area / landmark" className="addr-input" />
            </Field>
            <Field label="City *">
              <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} placeholder="City" className="addr-input" />
            </Field>
            <Field label="PIN Code *">
              <input value={draft.postal_code} onChange={(e) => setDraft((d) => ({ ...d, postal_code: e.target.value }))} placeholder="400001" className="addr-input" maxLength={6} />
            </Field>
            <Field label="State">
              <select value={draft.region} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} className="addr-input">
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Phone">
              <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+91 98765 43210" className="addr-input" />
            </Field>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))} className="h-4 w-4 accent-primary" />
            Set as default address
          </label>
          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="btn-glow inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {editingAddr ? "Update" : "Save Address"}
            </button>
            <button onClick={() => setFormOpen(false)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : addresses.length === 0 && !formOpen ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No saved addresses. Add one for faster checkout.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`rounded-2xl border bg-card p-4 ${addr.is_default ? "border-primary/40" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {addr.label && <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{addr.label}</div>}
                  <div className="font-semibold leading-tight">{addr.recipient}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {addr.street1}{addr.street2 ? `, ${addr.street2}` : ""}<br />
                    {addr.city}{addr.region ? `, ${addr.region}` : ""} — {addr.postal_code}
                    {addr.phone && <><br />{addr.phone}</>}
                  </div>
                </div>
                {addr.is_default && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                    Default
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-1.5">
                <button
                  onClick={() => openEdit(addr)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-muted"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => remove(addr.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .addr-input { width: 100%; border-radius: 0.75rem; border: 1px solid var(--border); background: var(--background); color: var(--foreground); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; margin-top: 0.25rem; }
        .addr-input:focus { border-color: var(--primary); }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
