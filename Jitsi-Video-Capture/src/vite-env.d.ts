/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
//// <reference types="vite-plugin-monkey/global" />
/// <reference types="vite-plugin-monkey/style" />

interface HTMLMediaElement {
  captureStream(frameRequestRate?: number): MediaStream;
  mozCaptureStream?(frameRequestRate?: number): MediaStream;
}
