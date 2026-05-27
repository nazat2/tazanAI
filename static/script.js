(function () {
    "use strict";

    function renderMarkdown(text) {
        if (!text) return "";
        try {
            marked.setOptions({ breaks: true, gfm: true });
            return marked.parse(text);
        } catch {
            return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
    }

    const $ = (id) => document.getElementById(id);
    const chatMessages = $("chatMessages");
    const userInput = $("userInput");
    const btnSend = $("btnSend");
    const btnClear = $("btnClear");
    const currentTime = $("currentTime");
    const sidebarToggle = $("sidebarToggle");
    const sidebar = $("sidebar");
    const overlay = $("overlay");
    const particlesContainer = $("particles");
    const memoryCount = $("memoryCount");
    const memoryInfo = $("memoryInfo");
    const installBanner = $("installBanner");
    const btnInstall = $("btnInstall");
    const btnDismiss = $("btnDismiss");

    let isProcessing = false;
    let chatHistory = [];
    let deferredPrompt = null;

    const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    function now() {
        const d = new Date();
        return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    function updateTime() {
        currentTime.textContent = now();
    }

    updateTime();
    setInterval(updateTime, 30000);

    function createParticles() {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 30; i++) {
            const p = document.createElement("div");
            p.classList.add("particle");
            p.style.left = `${Math.random() * 100}%`;
            p.style.top = `${Math.random() * 100}%`;
            frag.appendChild(p);
        }
        particlesContainer.appendChild(frag);
        document.querySelectorAll(".particle").forEach(p => {
            gsap.to(p, {
                opacity: Math.random() * 0.5 + 0.1,
                duration: Math.random() * 2 + 1,
                y: -Math.random() * 100 - 50,
                x: Math.random() * 60 - 30,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                delay: Math.random() * 3
            });
        });
    }

    createParticles();
    gsap.from(".sidebar", { x: -50, opacity: 0, duration: 0.8, ease: "power3.out" });
    gsap.from(".chat-input-area", { y: 40, opacity: 0, duration: 0.8, delay: 0.3, ease: "power3.out" });

    function toggleSidebar() {
        sidebar.classList.toggle("open");
        overlay.classList.toggle("active");
    }

    sidebarToggle.addEventListener("click", toggleSidebar);
    overlay.addEventListener("click", toggleSidebar);

    function autoResize() {
        userInput.style.height = "auto";
        userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
    }

    userInput.addEventListener("input", autoResize);
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    btnSend.addEventListener("click", sendMessage);

    function saveHistory() {
        try {
            const trimmed = chatHistory.slice(-20);
            localStorage.setItem("tazanai_history", JSON.stringify(trimmed));
            updateMemoryBadge();
        } catch {
            localStorage.removeItem("tazanai_history");
        }
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem("tazanai_history");
            if (raw) {
                const data = JSON.parse(raw);
                if (Array.isArray(data)) chatHistory = data.slice(-20);
            }
        } catch {
            chatHistory = [];
        }
        updateMemoryBadge();
    }

    function updateMemoryBadge() {
        if (chatHistory.length > 0) {
            memoryInfo.style.display = "flex";
            memoryCount.textContent = `${chatHistory.length} pesan`;
        } else {
            memoryInfo.style.display = "none";
        }
    }

    loadHistory();

    function clearChat() {
        chatHistory = [];
        localStorage.removeItem("tazanai_history");
        updateMemoryBadge();
        chatMessages.innerHTML = `
            <div class="welcome-message" id="welcomeMessage">
                <div class="welcome-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                        <path d="M9 9h.01M15 9h.01"/>
                    </svg>
                </div>
                <h2>Halo, aku TazanAI</h2>
                <p>Tanya apa saja, aku siap bantu.</p>
            </div>`;
        gsap.from("#welcomeMessage", { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" });
    }

    btnClear.addEventListener("click", clearChat);

    function removeWelcome() {
        const wm = $("welcomeMessage");
        if (wm) {
            gsap.to(wm, { opacity: 0, y: -20, duration: 0.3, ease: "power2.in", onComplete: () => wm.remove() });
        }
    }

    function createBubble(role) {
        const div = document.createElement("div");
        div.classList.add("message", role);

        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.textContent = role === "user" ? "U" : "TA";

        const content = document.createElement("div");
        content.classList.add("message-content");

        div.appendChild(avatar);
        div.appendChild(content);
        chatMessages.appendChild(div);
        gsap.from(div, { opacity: 0, y: 20, duration: 0.4, ease: "power2.out" });

        return content;
    }

    function addTyping() {
        removeWelcome();
        const div = document.createElement("div");
        div.classList.add("message", "assistant");
        div.id = "typingMessage";

        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.textContent = "TA";

        const content = document.createElement("div");
        content.classList.add("message-content");
        content.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

        div.appendChild(avatar);
        div.appendChild(content);
        chatMessages.appendChild(div);
        scrollBottom();
    }

    function removeTyping() {
        const el = $("typingMessage");
        if (el) el.remove();
    }

    function scrollBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendMessage() {
        const prompt = userInput.value.trim();
        if (!prompt || isProcessing) return;

        isProcessing = true;
        btnSend.disabled = true;
        userInput.value = "";
        userInput.style.height = "auto";

        removeWelcome();
        createBubble("user").innerHTML = renderMarkdown(prompt);
        scrollBottom();
        addTyping();

        chatHistory.push({ role: "user", content: prompt });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    history: chatHistory.slice(-20)
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            removeTyping();

            const data = await response.json();
            const reply = data.reply || "Tidak ada respon.";

            const bubble = createBubble("assistant");

            if (data.error || reply.startsWith("Error")) {
                bubble.innerHTML = renderMarkdown("Maaf, terjadi kesalahan. Coba lagi.");
            } else {
                bubble.innerHTML = renderMarkdown(reply);
                chatHistory.push({ role: "assistant", content: reply });
                saveHistory();
            }

            scrollBottom();

        } catch (e) {
            clearTimeout(timeout);
            removeTyping();

            if (e.name === "AbortError") {
                createBubble("assistant").innerHTML = renderMarkdown("Waktu habis. Coba pertanyaan yang lebih singkat.");
            } else {
                createBubble("assistant").innerHTML = renderMarkdown("Gagal terhubung. Periksa koneksi.");
            }
            scrollBottom();
        }

        isProcessing = false;
        btnSend.disabled = false;
        userInput.focus();
    }

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/static/sw.js").catch(() => {});
        });
    }

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBanner.style.display = "block";
        gsap.from(installBanner, { y: 100, opacity: 0, duration: 0.5, ease: "power2.out" });
    });

    btnInstall.addEventListener("click", async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === "accepted") {
                installBanner.style.display = "none";
            }
            deferredPrompt = null;
        }
    });

    btnDismiss.addEventListener("click", () => {
        gsap.to(installBanner, { y: 100, opacity: 0, duration: 0.3, ease: "power2.in", onComplete: () => {
            installBanner.style.display = "none";
        }});
    });

    window.addEventListener("appinstalled", () => {
        installBanner.style.display = "none";
    });
})();