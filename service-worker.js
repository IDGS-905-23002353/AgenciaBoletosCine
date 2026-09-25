const CACHE_NAME = "cine-cache-v3"; // Cambiado a v3 para forzar actualización
const RECURSOS = [
    "./", 
    "./index.html", 
    "./login.html", // Estandarizado con ./
    "./css/style.css", 
    "./js/app.js", 
    "./js/auth.js", 
    "./manifest.webmanifest", 
    "./icon-192.png", 
    "./icon-512.png"
];

// Bootstrap, iconos y fuentes (vienen de otros servidores)
const RECURSOS_CDN = [
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js",
    "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css",
    "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap",
    "https://cdn.jsdelivr.net/npm/sweetalert2@11"
];
const ORIGENES_CDN = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

const esApi = (url) => url.includes("/api/");
const esCdn = (url) => ORIGENES_CDN.some((origen) => url.includes(origen));

self.addEventListener("install", (event) => {
    console.log("SW: instalando v3");
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const respuesta = await fetch("./");
            const html = await respuesta.text();
            const respuestaLimpia = new Response(html, {
                status: 200,
                headers: { "Content-Type": "text/html" }
            });
            await cache.put("./", respuestaLimpia);
            await cache.addAll(RECURSOS);
            // Se precachea el CDN desde la instalacion
            try {
                await cache.addAll(RECURSOS_CDN);
            } catch (error) {
                console.warn("SW: no se pudo precachear el CDN", error);
            }
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("SW: activado v3");
    event.waitUntil(
        caches.keys().then((nombres) => {
            return Promise.all(
                nombres.filter(nombre => nombre !== CACHE_NAME).map(nombre => caches.delete(nombre))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    // POST/PUT/DELETE (apartar, comprar, admin) nunca se cachean: siempre necesitan al servidor
    if (event.request.method !== "GET") return;

    // Corrección para la navegación entre múltiples páginas (index y login)
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cache = await caches.open(CACHE_NAME);
                // 1. Intentar buscar la URL exacta (ej. login.html) en la caché
                const enCache = await cache.match(event.request);
                if (enCache) {
                    return enCache;
                }
                // 2. Fallback al index si no existe
                return cache.match("./");
            })
        );
        return;
    }

    // ---------- API del cine ----------
    if (esApi(event.request.url)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                try {
                    const respuesta = await fetch(event.request);
                    if (respuesta && respuesta.ok) {
                        cache.put(event.request, respuesta.clone());
                    }
                    return respuesta;
                } catch (error) {
                    const enCache = await cache.match(event.request);
                    // Sin copia se responde una lista vacia para que la pagina no truene
                    return enCache || new Response("[]", {
                        status: 503,
                        headers: { "Content-Type": "application/json" }
                    });
                }
            })
        );
        return;
    }

    // ---------- CDN (Bootstrap, iconos, fuentes) ----------
    if (esCdn(event.request.url)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const enCache = await cache.match(event.request);

                const desdeRed = fetch(event.request)
                    .then((respuesta) => {
                        if (respuesta && (respuesta.ok || respuesta.type === "opaque")) {
                            cache.put(event.request, respuesta.clone());
                        }
                        return respuesta;
                    })
                    .catch(() => enCache);

                return enCache || desdeRed;
            })
        );
        return;
    }

    // Estrategia general para el resto de archivos (imágenes, CSS, JS)
    event.respondWith(
        caches.match(event.request).then((respuesta) => {
            return respuesta || fetch(event.request);
        })
    );
});