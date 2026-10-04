import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  
  try {
    const { latitude, longitude, traveler_id } = await req.json();
    
    if (!traveler_id || !latitude || !longitude) {
      return new Response(JSON.stringify({ error: "Missing required fields: traveler_id, latitude, longitude" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { data, error } = await supabase
      .from('sos_alerts')
      .insert([
        {
          traveler_id,
          latitude,
          longitude,
          status: 'active'
        }
      ]);

    if (error) {
      throw error;
    }
    
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
