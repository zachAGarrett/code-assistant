// cliUtils.ts

export function stopLoadingAnimation(timeout: NodeJS.Timeout) {
  clearInterval(timeout);
  process.stdout.write("\n");
}

export function startLoadingAnimation(message: string, interval: number = 500) {
  process.stdout.write("\n" + `${message}`);
  let dots = 0;
  let timeout: NodeJS.Timeout;
  timeout = setInterval(() => {
    process.stdout.write("."); // Add dot
    dots++;
    if (dots === 3) {
      dots = 0;
      process.stdout.write("\r" + message); // Reset to message state
    }
  }, interval);

  return timeout;
}

export async function animate<T>(
  callback: () => Promise<T>,
  message: string,
  interval?: number
): Promise<T> {
  const timeout = startLoadingAnimation(message, interval);

  try {
    // Execute the provided callback function and return its result
    const result = await callback();
    return result; // Return the callback's result
  } finally {
    stopLoadingAnimation(timeout);
  }
}
