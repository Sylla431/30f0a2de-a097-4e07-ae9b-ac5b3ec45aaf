/**
 * Wraps a promise (or PromiseLike) with a timeout. Rejects with a user-friendly
 * French message if the promise doesn't resolve within the given time.
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number = 25000,
  errorMessage: string = 'Le serveur met trop de temps à répondre. Veuillez réessayer.'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);

    Promise.resolve(promise)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
