"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
}

interface UserPickerProps {
  loggedInUserId: string;
  currentViewId: string;
  date: string;
}

export default function UserPicker({ loggedInUserId, currentViewId, date }: UserPickerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function handleSelectUser(userId: string) {
    const params = new URLSearchParams({ date });
    if (userId !== loggedInUserId) params.set("view", userId);
    router.push(`/?${params}`);
  }

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {users.map((u) => {
        const isActive = u.id === currentViewId;
        const isMe = u.id === loggedInUserId;
        return (
          <button
            key={u.id}
            onClick={() => handleSelectUser(u.id)}
            className={[
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            ].join(" ")}
          >
            {u.name}{isMe ? " (you)" : ""}
          </button>
        );
      })}
      <button
        onClick={handleLogout}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        Log out
      </button>
    </div>
  );
}
