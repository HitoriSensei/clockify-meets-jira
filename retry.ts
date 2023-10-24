export function retry<T>(
  generator: (count: number) => Promise<T>,
  amount: number,
  delay: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = (count: number) => {
      generator(count)
        .then(resolve)
        .catch((err) => {
          if (count < amount) {
            setTimeout(() => run(count + 1), delay);
          } else {
            reject(err);
          }
        });
    };
    run(0);
  });
}
