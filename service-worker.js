const CACHE_NAME = "photo-timer-v3";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];


// アプリをインストールするとき
self.addEventListener("install", (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME).then((cache) => {

            return cache.addAll(FILES_TO_CACHE);

        })

    );

    // 新しいService Workerをすぐに有効にする
    self.skipWaiting();

});


// 古いキャッシュを削除
self.addEventListener("activate", (event) => {

    event.waitUntil(

        caches.keys().then((cacheNames) => {

            return Promise.all(

                cacheNames.map((cacheName) => {

                    if (cacheName !== CACHE_NAME) {

                        return caches.delete(cacheName);

                    }

                })

            );

        })

    );

    // 開いているページにも新しいService Workerを適用
    self.clients.claim();

});


// ページを開いたとき
self.addEventListener("fetch", (event) => {

    event.respondWith(

        caches.match(event.request).then((response) => {

            return response || fetch(event.request);

        })

    );

});
