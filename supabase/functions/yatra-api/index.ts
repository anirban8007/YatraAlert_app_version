import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OLA_API_KEY = Deno.env.get("OLA_API_KEY") || "TaF8ZPfiZp2Z1UQbX5XEnWCBqDu3EbzBQaMWzBoR";
const OLA_CLIENT_ID = Deno.env.get("OLA_CLIENT_ID") || "f25b2f83-782d-4a4a-a076-54a099d5659b";
const OLA_CLIENT_SECRET = Deno.env.get("OLA_CLIENT_SECRET") || "ed6aaf1a39e24c6ba7a8be1083711e11";

// CORS configuration for React Native calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Polyline decoder for Ola Maps overview_polyline
function decodePolyline(encoded: string): number[][] {
  const points: number[][] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lng / 1e5, lat / 1e5]); // [lng, lat] for GeoJSON
  }
  return points;
}

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

    // ── 2. DIRECTIONS PROXY (OLA MAPS) ──────────────────────────
    if (action === "directions") {
      const { orig_lat, orig_lng, dest_lat, dest_lng } = payload;
      
      // Attempt Ola Maps routing first
      try {
        const olaUrl = `https://api.olamaps.io/routing/v1/directions?origin=${orig_lat},${orig_lng}&destination=${dest_lat},${dest_lng}&api_key=${OLA_API_KEY}`;
        const olaRes = await fetch(olaUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": crypto.randomUUID()
          }
        });
        
        if (olaRes.ok) {
          const data = await olaRes.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const leg = route.legs?.[0] || route;
            const distance_meters = leg.distance || route.distance || 0;
            const duration_seconds = leg.duration || route.duration || 0;

            const distance_km = (distance_meters / 1000).toFixed(1);
            const duration_min = Math.round(duration_seconds / 60);
            const time_str = duration_min >= 60 
              ? `${Math.floor(duration_min / 60)}h ${duration_min % 60}min` 
              : `${duration_min} min`;

            let geometry = route.geometry;
            if (!geometry && route.overview_polyline) {
              const coords = typeof route.overview_polyline === 'string'
                ? decodePolyline(route.overview_polyline)
                : route.overview_polyline;
              geometry = { type: "LineString", coordinates: coords };
            } else if (typeof geometry === 'string') {
              const coords = decodePolyline(geometry);
              geometry = { type: "LineString", coordinates: coords };
            }

            return new Response(JSON.stringify({
              distance_km,
              time_str: `${time_str} (incl. traffic)`,
              duration_min,
              geometry,
              source: "olamaps"
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else {
          // Fallback to GET method if POST is not accepted
          const olaGetUrl = `https://api.olamaps.io/routing/v1/directions?origin=${orig_lat},${orig_lng}&destination=${dest_lat},${dest_lng}&api_key=${OLA_API_KEY}`;
          const olaGetRes = await fetch(olaGetUrl);
          if (olaGetRes.ok) {
            const data = await olaGetRes.json();
            if (data.routes && data.routes.length > 0) {
              const route = data.routes[0];
              const leg = route.legs?.[0] || route;
              const distance_meters = leg.distance || route.distance || 0;
              const duration_seconds = leg.duration || route.duration || 0;

              const distance_km = (distance_meters / 1000).toFixed(1);
              const duration_min = Math.round(duration_seconds / 60);
              const time_str = duration_min >= 60 
                ? `${Math.floor(duration_min / 60)}h ${duration_min % 60}min` 
                : `${duration_min} min`;

              let geometry = route.geometry;
              if (!geometry && route.overview_polyline) {
                const coords = typeof route.overview_polyline === 'string'
                  ? decodePolyline(route.overview_polyline)
                  : route.overview_polyline;
                geometry = { type: "LineString", coordinates: coords };
              } else if (typeof geometry === 'string') {
                const coords = decodePolyline(geometry);
                geometry = { type: "LineString", coordinates: coords };
              }

              return new Response(JSON.stringify({
                distance_km,
                time_str: `${time_str} (incl. traffic)`,
                duration_min,
                geometry,
                source: "olamaps"
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
        }
      } catch (e) {
        console.error("Ola Maps Route Failed, falling back to OSRM", e);
      }

      // Fallback to OSRM if Ola Maps fails
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