import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="h-9 w-9 animate-pulse rounded-full border border-border bg-card/60" />
    );
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Link>
    );
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Account";
  const initial = name.trim().charAt(0).toUpperCase();
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="group relative">
      <button className="flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-3 text-sm font-medium backdrop-blur transition hover:bg-card">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate sm:inline">{name}</span>
      </button>

      <div className="invisible absolute right-0 top-full z-20 mt-2 w-56 origin-top-right scale-95 rounded-2xl border border-border bg-card/95 p-1.5 opacity-0 shadow-xl backdrop-blur-xl transition-all group-hover:visible group-hover:scale-100 group-hover:opacity-100">
        <div className="border-b border-border px-3 py-2.5">
          <p className="truncate text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-medium">{user.email}</p>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-background"
        >
          <UserIcon className="h-4 w-4" />
          My planner
        </Link>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
