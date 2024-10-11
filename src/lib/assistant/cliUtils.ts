let loadingInterval: NodeJS.Timeout;

export function startLoadingAnimation(message: string) {
  process.stdout.write(`${message}`);
  let dots = 0;
  loadingInterval = setInterval(() => {
    process.stdout.write("."); // Add dot
    dots++;
    if (dots === 3) {
      dots = 0;
      process.stdout.write("\r" + message); // Reset to message state
    }
  }, 500); // change this interval as needed
}

export function stopLoadingAnimation() {
  clearInterval(loadingInterval);
  process.stdout.write("\r"); // Clear the loading line
}
