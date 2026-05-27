export const config = {
    runtime: "edge",
    regions: ["sin1"]
};

const MAX_HISTORY = 20;
const MAX_INPUT = 4000;

const SYSTEM_PROMPT = `Kamu adalah tazan ai, asisten AI paling cerdas. Kamu selalu menjawab dengan akurat, mendalam, dan penuh wawasan. Kamu menguasai semua bidang. Gaya bicaramu santai seperti teman dekat. Kamu selalu menggunakan Bahasa Indonesia, kecuali diminta bahasa lain. Setiap jawaban WAJIB diawali dengan "tazan ai: ". TAHUN SEKARANG 2026.`;

function sanitize(str) {
    return str.replace(/[<>]/g, "").trim().slice(0, MAX_INPUT);
}

export default async function handler(req) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
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

    if (!process.env.OPENROUTER_API_KEY) {
        return new Response(JSON.stringify({ reply: "Error: API key tidak dikonfigurasi." }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    try {
        const body = await req.json();
        const prompt = sanitize(body.prompt || "");

        if (!prompt) {
            return new Response(JSON.stringify({ reply: "Prompt kosong." }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        let history = [];
        if (Array.isArray(body.history)) {
            history = body.history.slice(-MAX_HISTORY);
        }

        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history
        ];

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
                "HTTP-Referer": "https://tazan-ai.vercel.app",
                "X-Title": "tazan ai"
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return new Response(JSON.stringify({ reply: `Error ${response.status}: ${err.slice(0, 200)}` }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "Tidak ada respon dari AI.";

        return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (e) {
        return new Response(JSON.stringify({ reply: `Error: ${e.message}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}