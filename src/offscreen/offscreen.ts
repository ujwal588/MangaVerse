// Offscreen document script for image processing, canvas crop, and OCR operations

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PROCESS_IMAGE_CROP') {
    const { dataUrl, cropX, cropY, cropWidth, cropHeight, targetWidth, targetHeight } = message;

    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('offscreen-canvas') as HTMLCanvasElement;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        sendResponse({ success: false, error: 'Could not acquire canvas context' });
        return;
      }

      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      const exportedDataUrl = canvas.toDataURL('image/png');
      sendResponse({ success: true, exportedDataUrl });
    };

    img.onerror = (e) => {
      sendResponse({ success: false, error: String(e) });
    };

    img.src = dataUrl;
    return true; // Keep response channel open
  }
});
