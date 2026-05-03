import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Save, Mail, Key } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/profile")({
  component: DashboardProfile,
});

function DashboardProfile() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwEmail, setPwEmail] = useState(user?.email ?? "");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, referral_code")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setReferralCode(data.referral_code ?? "");
        }
        setLoading(false);
      });
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    if (!pwEmail) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(pwEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setSendingReset(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profile info */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl tracking-wide">
          <User className="h-5 w-5 text-primary" /> Profile
        </h2>

        <div className="space-y-4">
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="prof-input"
            />
          </Field>

          <Field label="Email address">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              {user?.email}
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">Verified</span>
            </div>
          </Field>

          {referralCode && (
            <Field label="Referral code">
              <div className="rounded-xl border border-border bg-muted px-3 py-2.5 font-mono text-sm">
                {referralCode}
              </div>
            </Field>
          )}

          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-glow inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </button>
        </div>
      </section>

      {/* Password reset */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 flex items-center gap-2 font-display text-xl tracking-wide">
          <Key className="h-4 w-4 text-primary" /> Change Password
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">We'll send a password reset link to your email.</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={pwEmail}
            onChange={(e) => setPwEmail(e.target.value)}
            placeholder="Your email"
            className="prof-input flex-1"
          />
          <button
            onClick={sendPasswordReset}
            disabled={sendingReset}
            className="btn-glow inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {sendingReset ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
            Send Reset
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-destructive/30 bg-card p-6">
        <h2 className="mb-1 font-display text-xl tracking-wide text-destructive">Sign Out</h2>
        <p className="mb-4 text-xs text-muted-foreground">Sign out of your account on this device.</p>
        <button
          onClick={() => signOut()}
          className="rounded-full border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10"
        >
          Sign Out
        </button>
      </section>

      <style>{`
        .prof-input { width: 100%; border-radius: 0.75rem; border: 1px solid var(--border); background: var(--background); color: var(--foreground); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .prof-input:focus { border-color: var(--primary); }
      `}</style>
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
