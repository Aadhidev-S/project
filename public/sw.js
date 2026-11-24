importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts(__uv$config.sw || '/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      if (uv.route(event)) {
        const headers = new Headers(event.request.headers);
        headers.set('Accept-Language', 'en-US,en;q=0.9');

        const modifiedRequest = new Request(event.request, { headers });
        return await uv.fetch({ request: modifiedRequest });
      }
      return await fetch(event.request);
    })()
  );
});
