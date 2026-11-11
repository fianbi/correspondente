"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { aceitarConvite } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await aceitarConvite(token);
            if (result?.error) setError(result.error);
          })
        }
      >
        Entrar na equipe
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-status-reprovado">
          {error}
        </p>
      ) : null}
    </div>
  );
}
