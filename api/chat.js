export const config = {
    runtime: "edge",
    regions: ["sin1"]
};

const MAX_HISTORY = 10;
const MAX_INPUT = 4000;

const SYSTEM_PROMPT = `Kamu adalah tazan ai, asisten AI paling cerdas. Kamu selalu menjawab dengan akurat, mendalam, dan penuh wawasan. Kamu menguasai semua bidang. Gaya bicaramu santai seperti teman dekat. Kamu selalu menggunakan Bahasa Indonesia, kecuali diminta bahasa lain. TAHUN SEKARANG 2026.`;

function sanitize(str) {
    return str.replace(/[<>]/g, "").trim().slice(0, MAX_INPUT);
}

function parseHistory(cookie) {
    if (!cookie) return [];
    try {
        const decoded = decodeURIComponent(cookie);
        const data = JSON.parse(decoded);
        return Array.isArray(data) ? data.slice(-MAX_HISTORY * 2) : [];
    } catch {
        return [];
    }
}

export default async function handler(req) {
    const origin = req.headers.get("origin") || "*";

    const corsHeaders = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400"
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    try {
        const body = await req.json();
        const prompt = sanitize(body.prompt || "");

        if (!prompt) {
            return new Response(JSON.stringify({ error: "Prompt kosong" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const cookies = req.headers.get("cookie") || "";
        const match = cookies.match(/tazanai_history=([^;]+)/);
        const history = parseHistory(match ? match[1] : null);

        history.push({ role: "user", content: prompt });

        const isComplex = prompt.length > 60 || [
            "jelaskan", "analisis", "buatkan", "bagaimana", "mengapa",
            "tulis", "rangkum", "hitung", "bandingkan", "kode", "script",
            "program", "algoritma", "debug", "error", "fix", "perbaiki"
        ].some(kw => prompt.toLowerCase().includes(kw));

        const model = isComplex ? "deepseek/deepseek-r1" : "deepseek/deepseek-chat";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tazanai.vercel.app",
                "X-Title": "tazan ai"
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
                temperature: 0.7,
                max_tokens: 3000,
                top_p: 0.95,
                stream: true
            })
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ error: `API error: ${response.status}` }), {
                status: 502,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split("\n");

                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const data = line.slice(6);
                                if (data === "[DONE]") {
                                    history.push({ role: "assistant", content: fullResponse });
                                    const trimmed = history.slice(-MAX_HISTORY * 2);
                                    const payload = JSON.stringify({ done: true, history: trimmed });
                                    controller.enqueue(`data: ${payload}\n\n`);
                                    controller.close();
                                    return;
                                }
                                try {
                                    const parsed = JSON.parse(data);
                                    const content = parsed.choices?.[0]?.delta?.content;
                                    if (content) {
                                        fullResponse += content;
                                        controller.enqueue(`data: ${JSON.stringify({ content })}\n\n`);
                                    }
                                } catch {
                                    continue;
                                }
                            }
                        }
                    }
                    controller.close();
                } catch {
                    controller.enqueue(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Content-Type-Options": "nosniff"
            }
        });

    } catch {
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}