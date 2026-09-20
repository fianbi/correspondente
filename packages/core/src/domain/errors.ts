/** Erro de regra de negócio — vira 4xx na borda HTTP, não 500. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} não encontrado.`, "not_found", 404);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message, "forbidden", 403);
    this.name = "ForbiddenError";
  }
}
