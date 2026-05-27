(function () {
    "use strict";

    function renderMarkdown(text) {
        if (!text) return "";
        try {
            if (typeof marked !== "undefined") {
                marked.setOptions({ breaks: true, gfm: true });
                return marked.parse(text);
            }
            return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        } catch {
            return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
    }

    const chatMessages = document.getElementById("chatMessages");
    const userInput = document.getElementById("userInput");
    const btnSend = document.getElementById("btnSend");
    const btnClear = document.getElementById("btnClear");
    const btnClearTop = document.getElementById("btnClearTop");
    const currentTime = document.getElementById("currentTime");
    const hamburgerBtn = document.getElementById("hamburgerToggle");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const sidebarClose = document.getElementById("sidebarClose");
    const particlesContainer = document.getElementById("particles");
    const memoryCount = document.getElementById("memoryCount");
    const memoryInfo = document.getElementById("memoryInfo");
    const installBanner = document.getElementById("installBanner");
    const btnInstall = document.getElementById("btnInstall");
    const btnDismiss = document.getElementById("btnDismiss");

    let isProcessing = false;
    let chatHistory = [];
    let deferredPrompt = null;

    const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    function updateTime() {
        if (!currentTime) return;
        const d = new Date();
        currentTime.textContent = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    updateTime();
    setInterval(updateTime, 30000);

    function createParticles() {
        if (!particlesContainer || typeof gsap === "undefined") return;
        for (let i = 0; i < 40; i++) {
            const p = document.createElement("div");
            p.classList.add("particle");
            p.style.left = `${Math.random() * 100}%`;
            p.style.top = `${Math.random() * 100}%`;
            particlesContainer.appendChild(p);
            gsap.to(p, {
                opacity: Math.random() * 0.4 + 0.1,
                duration: Math.random() * 3 + 2,
                y: -Math.random() * 100 - 50,
                x: Math.random() * 80 - 40,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                delay: Math.random() * 4
            });
        }
    }
    createParticles();

    /* ========== SIDEBAR ========== */
    function isDesktop() { return window.innerWidth >= 769; }

    function openSidebar() {
        document.body.classList.add("sidebar-open");
        if (isDesktop()) document.body.classList.remove("sidebar-closed");
        if (hamburgerBtn) hamburgerBtn.classList.add("active");
    }

    function closeSidebar() {
        document.body.classList.remove("sidebar-open");
        if (isDesktop()) document.body.classList.add("sidebar-closed");
        if (hamburgerBtn) hamburgerBtn.classList.remove("active");
    }

    function toggleSidebar() {
        if (document.body.classList.contains("sidebar-open")) closeSidebar();
        else openSidebar();
    }

    function initSidebar() {
        if (isDesktop()) {
            document.body.classList.remove("sidebar-open", "sidebar-closed");
            document.body.classList.add("sidebar-open");
            if (hamburgerBtn) hamburgerBtn.classList.add("active");
        } else {
            document.body.classList.remove("sidebar-open", "sidebar-closed");
            if (hamburgerBtn) hamburgerBtn.classList.remove("active");
        }
    }
    initSidebar();

    if (hamburgerBtn) hamburgerBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleSidebar(); });
    if (sidebarClose) sidebarClose.addEventListener("click", () => closeSidebar());
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", () => closeSidebar());

    document.addEventListener("click", (e) => {
        if (!document.body.classList.contains("sidebar-open")) return;
        if (isDesktop()) return;
        if (sidebar && sidebar.contains(e.target)) return;
        if (hamburgerBtn && hamburgerBtn.contains(e.target)) return;
        closeSidebar();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("sidebar-open")) closeSidebar();
    });

    window.addEventListener("resize", () => initSidebar());

    let touchStartX = 0;
    document.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].screenX; });
    document.addEventListener("touchend", (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const deltaX = touchEndX - touchStartX;
        if (touchStartX < 35 && deltaX > 70 && !document.body.classList.contains("sidebar-open")) openSidebar();
        if (document.body.classList.contains("sidebar-open") && deltaX < -60) closeSidebar();
    });

    /* ========== CHAT ========== */
    function autoResize() {
        userInput.style.height = "auto";
        userInput.style.height = `${Math.min(userInput.scrollHeight, 120)}px`;
    }
    userInput.addEventListener("input", autoResize);
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    btnSend.addEventListener("click", sendMessage);

    function saveHistory() {
        try {
            const trimmed = chatHistory.slice(-30);
            localStorage.setItem("tazanai_history", JSON.stringify(trimmed));
            updateMemoryBadge();
        } catch { localStorage.removeItem("tazanai_history"); }
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem("tazanai_history");
            if (raw) {
                const data = JSON.parse(raw);
                if (Array.isArray(data)) chatHistory = data.slice(-30);
                for (const msg of chatHistory) {
                    if (msg.role === "user") createBubble("user", msg.content);
                    else if (msg.role === "assistant") createBubble("assistant", msg.content);
                }
            }
        } catch { chatHistory = []; }
        updateMemoryBadge();
    }

    function updateMemoryBadge() {
        if (!memoryInfo || !memoryCount) return;
        if (chatHistory.length > 0) {
            memoryInfo.style.display = "flex";
            memoryCount.textContent = `${chatHistory.length} pesan`;
        } else memoryInfo.style.display = "none";
    }

    function clearChat() {
        chatHistory = [];
        localStorage.removeItem("tazanai_history");
        updateMemoryBadge();
        chatMessages.innerHTML = `
            <div class="welcome-message" id="welcomeMessage">
                <div class="welcome-icon">
                    <img src="https://img.icons8.com/?size=100&id=qCyjxePmto0j&format=png&color=000000" alt="TazanAI" width="80" height="80" style="filter: brightness(0) invert(1);">
                </div>
                <h2>Halo! Saya TazanAI 👋</h2>
                <p>Tanya apa saja, saya siap membantu Anda 24/7</p>
            </div>`;
        if (typeof gsap !== "undefined") gsap.from("#welcomeMessage", { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" });
    }

    if (btnClear) btnClear.addEventListener("click", clearChat);
    if (btnClearTop) btnClearTop.addEventListener("click", clearChat);

    function removeWelcome() {
        const wm = document.getElementById("welcomeMessage");
        if (wm) { if (typeof gsap !== "undefined") gsap.to(wm, { opacity: 0, y: -20, duration: 0.3, ease: "power2.in", onComplete: () => wm.remove() }); else wm.remove(); }
    }

    function createBubble(role, content) {
        removeWelcome();
        const div = document.createElement("div");
        div.classList.add("message", role);
        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.innerHTML = role === "user"
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
        const contentDiv = document.createElement("div");
        contentDiv.classList.add("message-content");
        contentDiv.innerHTML = renderMarkdown(content);
        div.appendChild(avatar);
        div.appendChild(contentDiv);
        chatMessages.appendChild(div);
        if (typeof gsap !== "undefined") gsap.from(div, { opacity: 0, y: 20, duration: 0.4, ease: "power2.out" });
        scrollBottom();
        return contentDiv;
    }

    function addTyping() {
        removeWelcome();
        const div = document.createElement("div");
        div.classList.add("message", "assistant");
        div.id = "typingMessage";
        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
        const content = document.createElement("div");
        content.classList.add("message-content");
        content.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        div.appendChild(avatar);
        div.appendChild(content);
        chatMessages.appendChild(div);
        scrollBottom();
    }

    function removeTyping() { const el = document.getElementById("typingMessage"); if (el) el.remove(); }
    function scrollBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }

    async function sendMessage() {
        const prompt = userInput.value.trim();
        if (!prompt || isProcessing) return;
        isProcessing = true;
        btnSend.disabled = true;
        userInput.value = "";
        userInput.style.height = "auto";
        createBubble("user", prompt);
        addTyping();
        chatHistory.push({ role: "user", content: prompt });
        saveHistory();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, history: chatHistory.slice(-30) }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            removeTyping();
            const data = await response.json();
            const reply = data.reply || "Tidak ada respon.";
            const bubble = createBubble("assistant", reply);
            if (!reply.startsWith("Error")) {
                chatHistory.push({ role: "assistant", content: reply });
                saveHistory();
            }
            scrollBottom();
        } catch (e) {
            clearTimeout(timeout);
            removeTyping();
            createBubble("assistant", e.name === "AbortError" ? "⏰ Waktu habis. Coba lagi." : "📡 Gagal terhubung.");
            scrollBottom();
        }
        isProcessing = false;
        btnSend.disabled = false;
        userInput.focus();
    }

    loadHistory();
    if (chatMessages.children.length === 0 || !chatMessages.querySelector(".welcome-message")) {
        if (chatHistory.length === 0) clearChat();
    }
    userInput.focus();

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => navigator.serviceWorker.register("/static/sw.js").catch(() => {}));
    }

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBanner) { installBanner.style.display = "block"; if (typeof gsap !== "undefined") gsap.from(installBanner, { y: 100, opacity: 0, duration: 0.5, ease: "power2.out" }); }
    });
    if (btnInstall) btnInstall.addEventListener("click", async () => {
        if (deferredPrompt) { deferredPrompt.prompt(); const result = await deferredPrompt.userChoice; if (result.outcome === "accepted") installBanner.style.display = "none"; deferredPrompt = null; }
    });
    if (btnDismiss) btnDismiss.addEventListener("click", () => {
        if (typeof gsap !== "undefined") gsap.to(installBanner, { y: 100, opacity: 0, duration: 0.3, ease: "power2.in", onComplete: () => installBanner.style.display = "none" });
        else installBanner.style.display = "none";
    });
    window.addEventListener("appinstalled", () => { if (installBanner) installBanner.style.display = "none"; });

    if (typeof gsap !== "undefined") {
        gsap.from(".welcome-message", { opacity: 0, y: 30, duration: 0.8, ease: "power2.out" });
        gsap.from(".top-bar", { y: -50, opacity: 0, duration: 0.6, ease: "power2.out" });
        gsap.from(".chat-input-area", { y: 50, opacity: 0, duration: 0.6, delay: 0.2, ease: "power2.out" });
    }
})();