self.addEventListener('fetch', function(event) {
    // 简单的离线穿透，真实生产环境可配置复杂缓存策略
    event.respondWith(
        fetch(event.request).catch(function() {
            return caches.match(event.request);
        })
    );
});