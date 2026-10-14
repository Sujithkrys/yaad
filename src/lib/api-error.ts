/** An error whose message is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} was not found.`);
