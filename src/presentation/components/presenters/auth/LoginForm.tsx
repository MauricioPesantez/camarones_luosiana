"use client";

export interface LoginFormProps {
  readonly usuario: string;
  readonly clave: string;
  readonly onUsuario: (valor: string) => void;
  readonly onClave: (valor: string) => void;
  readonly onSubmit: () => void;
  readonly puedeEnviar: boolean;
  readonly procesando?: boolean;
  readonly error?: string | null;
}

const INPUT =
  "min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground";

/**
 * Formulario de inicio de sesión (R1.1). Presentacional puro: captura usuario y
 * clave y emite `onSubmit`. Muestra el mensaje de error genérico que resuelve
 * el container (sin revelar si el usuario existe o la clave es incorrecta).
 */
export function LoginForm({
  usuario,
  clave,
  onUsuario,
  onClave,
  onSubmit,
  puedeEnviar,
  procesando = false,
  error,
}: LoginFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border p-6"
    >
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">Camarones Louisiana</h1>
        <p className="text-sm text-muted-foreground">Inicia sesión para continuar</p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Usuario
        <input
          type="text"
          autoComplete="username"
          autoFocus
          value={usuario}
          onChange={(e) => onUsuario(e.target.value)}
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Clave
        <input
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => onClave(e.target.value)}
          className={INPUT}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!puedeEnviar || procesando}
        className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {procesando ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
