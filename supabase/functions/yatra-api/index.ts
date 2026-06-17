import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const MAPMYINDIA_API_KEY = Deno.env.get("MAPMYINDIA_API_KEY");
const MMI_CLIENT_ID = Deno.env.get("MMI_CLIENT_ID");
const MMI_CLIENT_SECRET = Deno.env.get("MMI_CLIENT_SECRET");

// CORS configuration for React Native calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();

    // ── 1. SOS DISPATCH ──────────────────────────────────────
    if (action === "sos/send") {
      const { lat, lng, chat_ids, custom_message, update_number } = payload;
      
      const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
      const msg = `🚨 ${custom_message}\n\n📍 Live Location:\n${mapsLink}\n\n📌 Update #${update_number} — sent by YatraAlert`;

      const results = [];
      for (const chatId of chat_ids) {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" }),
        });
        results.push({ chat_id: chatId, ok: response.ok });
      }

      return new Response(JSON.stringify({ status: "sent", results }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      });
    }

    // ── 2. DIRECTIONS PROXY ──────────────────────────────────
    if (action === "directions") {
      const { orig_lat, orig_lng, dest_lat, dest_lng } = payload;
      
      // Attempt MapMyIndia routing first
      try {
        const mmiUrl = `https://apis.mapmyindia.com/advancedmaps/v1/${MAPMYINDIA_API_KEY}/route_adv/driving/${orig_lng},{orig_lat};${dest_lng},{dest_lat}?steps=true&overview=full&geometries=geojson`;
        const mmiRes = await fetch(mmiUrl);
        
        if (mmiRes.ok) {
          const data = await mmiRes.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distance_km = (route.distance / 1000).toFixed(1);
            const duration_min = Math.round(route.duration / 60);
            const time_str = duration_min >= 60 
              ? `${Math.floor(duration_min / 60)}h ${duration_min % 60}min` 
              : `${duration_min} min`;

            return new Response(JSON.stringify({
              distance_km,
              time_str: `${time_str} (incl. traffic)`,
              duration_min,
              geometry: route.geometry,
              source: "mapmyindia"
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) {
        console.error("MMI Route Failed, falling back to OSRM", e);
      }

      // Fallback to OSRM if MMI fails
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${orig_lng},${orig_lat};${dest_lng},${dest_lat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      
      if (osrmData.code === "Ok" && osrmData.routes) {
        const route = osrmData.routes[0];
        const distance_km = (route.distance / 1000).toFixed(1);
        const duration_min = Math.round(route.duration / 60);
        const time_str = duration_min >= 60 
              ? `${Math.floor(duration_min / 60)}h ${duration_min % 60}min` 
              : `${duration_min} min`;

        return new Response(JSON.stringify({
          distance_km,
          time_str: `${time_str} (no traffic)`,
          duration_min,
          geometry: route.geometry,
          source: "osrm"
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      throw new Error("No routes found from any provider.");
    }

    // ── 3. SOS VERIFY (TELEGRAM PAIRING) ────────────────────
    if (action === "sos/verify") {
      const { code } = payload;
      
      try {
        // The old Python backend might have left an active webhook on this bot.
        // Telegram API blocks getUpdates if a webhook is active. We delete it first.
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);

        const updatesRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=100`);
        const updatesData = await updatesRes.json();
        
        if (!updatesData.ok) {
          return new Response(JSON.stringify({ error: `Telegram API Error: ${updatesData.description}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          });
        }

        const matchingUpdate = updatesData.result.reverse().find((update: any) => {
          return update.message && update.message.text && update.message.text.trim() === String(code);
        });

        if (matchingUpdate) {
          const chat_id = matchingUpdate.message.chat.id;
          
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              chat_id: chat_id, 
              text: "✅ Successfully linked to YatraAlert! You will now receive SOS alerts here." 
            }),
          });

          return new Response(JSON.stringify({ chat_id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          });
        }
        
        return new Response(JSON.stringify({ error: "Code not found. Please send the code to the bot first, wait a few seconds, and try again." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to connect to Telegram API: " + (e instanceof Error ? e.message : String(e)) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 
    });
  }
});