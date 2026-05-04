import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Loader2, Eye, EyeOff, Mail, Smartphone, ArrowLeft, Gift, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { validateIndianPhone } from "@/lib/currency";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — VendiMan" },
      { name: "description", content: "Sign in with email or mobile OTP to track orders, save addresses, and unlock loyalty rewards." },
    ],
  }),
  component: AuthPage,
});

type Channel = "email" | "phone";
type Mode = "signin" | "signup";
type ForgotStep = "email" | "otp" | "newpw";

function AuthPage() {
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel>("email");
  const [pendingRef] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("pending_referral_code") : null,
  );
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && localStorage.getItem("pending_referral_code") ? "signup" : "signin",
  );
  const [loading, setLoading] = useState(false);

  // Email sign-in / sign-up
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Phone OTP
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  function startResendTimer() {
    setResendIn(45);
    const t = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function exitForgot() {
    setForgotMode(false);
    setForgotStep("email");
    setForgotEmail("");
    setForgotOtp("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function processReferral() {
    const code = localStorage.getItem("pending_referral_code");
    if (!code) return;
    localStorage.removeItem("pending_referral_code");
    await supabase.rpc("process_referral_signup", { p_referrer_code: code });
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (signUpError) throw signUpError;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          toast.success("Account created! Check your inbox to confirm your email.");
          navigate({ to: "/" });
          return;
        }
        await processReferral();
        toast.success("Welcome to VendiMan!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSendOtp(e: FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setForgotStep("otp");
      startResendTimer();
      toast.success("Check your email for the 6-digit reset code.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset code");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (forgotOtp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: forgotOtp,
        type: "recovery",
      });
      if (error) throw error;
      setForgotStep("newpw");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated. You're now signed in.");
      exitForgot();
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    const check = validateIndianPhone(phone);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: check.e164,
        options: {
          channel: "sms",
          shouldCreateUser: true,
          data: name ? { full_name: name } : undefined,
        },
      });
      if (error) throw error;
      setOtpSent(true);
      startResendTimer();
      toast.success(`OTP sent to ${check.e164}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send OTP";
      if (/sms|phone|provider|disabled/i.test(msg)) {
        toast.error("SMS sign-in not yet enabled. Admin must configure Twilio in backend → Auth → Phone provider.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    const check = validateIndianPhone(phone);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: check.e164,
        token: otpCode,
        type: "sms",
      });
      if (error) throw error;
      await processReferral();
      toast.success("Signed in successfully");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendIn > 0) return;
    const check = validateIndianPhone(phone);
    if (!check.ok) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: check.e164,
        options: { channel: "sms", shouldCreateUser: true },
      });
      if (error) throw error;
      startResendTimer();
      toast.success("OTP resent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
        {pendingRef && !forgotMode && (
          <div className="mb-6 w-full rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-center text-sm">
            <Gift className="mr-1 inline h-4 w-4 text-primary" />
            You were invited by a friend!{" "}
            <span className="font-semibold text-primary">
              Sign up to unlock ₹50 welcome credits after your first order.
            </span>
          </div>
        )}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-ember shadow-ember">
          <Flame className="h-7 w-7 text-primary-foreground" />
        </div>

        {/* ── Forgot password flow ── */}
        {forgotMode ? (
          <>
            <h1 className="font-display text-4xl tracking-wide">Reset Password</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {forgotStep === "email" && "Enter your email to receive a reset code."}
              {forgotStep === "otp" && `We sent a 6-digit code to ${forgotEmail}.`}
              {forgotStep === "newpw" && "Choose a new password for your account."}
            </p>

            <div className="mt-8 w-full space-y-4">
              {forgotStep === "email" && (
                <form onSubmit={handleForgotSendOtp} className="space-y-3">
                  <input
                    type="email"
                    required
                    placeholder="Your email address"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send Reset Code
                  </button>
                </form>
              )}

              {forgotStep === "otp" && (
                <form onSubmit={handleForgotVerifyOtp} className="space-y-4">
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={forgotOtp} onChange={setForgotOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || forgotOtp.length !== 6}
                    className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify Code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotStep("email"); setForgotOtp(""); }}
                    className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "← Try a different email"}
                  </button>
                </form>
              )}

              {forgotStep === "newpw" && (
                <form onSubmit={handleUpdatePassword} className="space-y-3">
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="New password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    <KeyRound className="h-4 w-4" />
                    Update Password
                  </button>
                </form>
              )}
            </div>

            <button
              onClick={exitForgot}
              className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl tracking-wide">
              {mode === "signin" ? "Welcome Back" : "Join the Pack"}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to track orders and earn loyalty points."
                : "Create an account and get 10% off your first order."}
            </p>

            {/* Channel switcher */}
            <div className="mt-6 inline-flex w-full rounded-full border border-border bg-card p-1 text-xs font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => {
                  setChannel("email");
                  setOtpSent(false);
                  setOtpCode("");
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 transition ${
                  channel === "email" ? "bg-gradient-ember text-primary-foreground shadow-ember" : "text-muted-foreground"
                }`}
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setChannel("phone");
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 transition ${
                  channel === "phone" ? "bg-gradient-ember text-primary-foreground shadow-ember" : "text-muted-foreground"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile OTP
              </button>
            </div>

            {channel === "email" && (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="btn-glow mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-card py-3 text-sm font-semibold transition disabled:opacity-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </button>

                <div className="my-6 flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleEmailSubmit} className="w-full space-y-3">
                  {mode === "signup" && (
                    <input
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
                    />
                  )}
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="Password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signin" && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => { setForgotEmail(email); setForgotMode(true); }}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === "signin" ? "Sign In" : "Create Account"}
                  </button>
                </form>

                <button
                  onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                  className="mt-6 text-sm text-muted-foreground hover:text-primary"
                >
                  {mode === "signin" ? "New here? Create an account →" : "Already have an account? Sign in →"}
                </button>
              </>
            )}

            {channel === "phone" && (
              <div className="mt-6 w-full space-y-4">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Mobile number (India)
                      </span>
                      <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card focus-within:border-primary">
                        <span className="flex items-center bg-background px-3 text-sm font-semibold text-muted-foreground">+91</span>
                        <input
                          type="tel"
                          required
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="10-digit mobile number"
                          value={phone.replace(/^\+?91/, "")}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                          className="w-full bg-card px-3 py-3 text-sm focus:outline-none"
                        />
                      </div>
                    </label>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send OTP
                    </button>
                    <p className="text-center text-[11px] text-muted-foreground">
                      We'll text you a 6-digit code via SMS. Standard rates may apply.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode("");
                      }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3 w-3" /> Use a different number
                    </button>
                    <div className="rounded-xl border border-border bg-card p-4 text-center">
                      <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to</p>
                      <p className="mt-1 font-display text-lg">+91 {phone.replace(/^\+?91/, "")}</p>
                    </div>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="btn-glow flex w-full items-center justify-center gap-2 rounded-full bg-gradient-ember py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Verify & Sign In
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendIn > 0 || loading}
                      className="block w-full text-center text-xs text-muted-foreground hover:text-primary disabled:hover:text-muted-foreground"
                    >
                      {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                    </button>
                  </form>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="text-primary underline-offset-4 hover:underline">Terms & Conditions</Link>
              {" "}and{" "}
              <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">Privacy Policy</Link>.
            </p>

            <Link to="/" className="mt-3 text-xs text-muted-foreground hover:text-foreground">
              ← Back to home
            </Link>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
