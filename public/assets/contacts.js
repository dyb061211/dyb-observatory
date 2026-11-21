for (const item of document.querySelectorAll(".contact-item")) {
  const options = item.querySelector(".contact-options");
  const field = item.querySelector(".contact-value");
  const copy = item.querySelector(".contact-copy");
  const status = item.querySelector(".contact-status");

  // Keep native navigation. A webview that blocks the destination still shows the address.
  item.querySelector(".contact-row").addEventListener("click", () => {
    options.open = true;
  });

  copy.hidden = false;
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = "已复制";
    } catch {
      field.focus();
      field.select();
      status.textContent = "长按地址，选择「复制」。";
    }
  });
}
