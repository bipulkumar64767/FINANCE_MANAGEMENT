import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DemoUser {
  email: string;
  password: string;
  fullName: string;
  role: string;
  phone: string;
}

const demoUsers: DemoUser[] = [
  { email: "admin@demo.com", password: "demo1234", fullName: "System Admin", role: "SUPER_ADMIN", phone: "+91 90000 00001" },
  { email: "manager@demo.com", password: "demo1234", fullName: "Finance Manager", role: "ADMIN", phone: "+91 90000 00002" },
  { email: "retailer@demo.com", password: "demo1234", fullName: "Vijay Electronics", role: "RETAILER", phone: "+91 90000 00003" },
  { email: "customer@demo.com", password: "demo1234", fullName: "Rajesh Kumar", role: "CUSTOMER", phone: "+91 90000 00004" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results: Array<{ email: string; status: string; userId?: string }> = [];

    for (const user of demoUsers) {
      // Check if profile already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", user.email)
        .maybeSingle();

      if (existing) {
        results.push({ email: user.email, status: "already_exists", userId: existing.id });
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError) {
        results.push({ email: user.email, status: `error: ${authError.message}` });
        continue;
      }

      const userId = authData.user.id;

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        phone: user.phone,
        status: "ACTIVE",
        retailer_id: user.role === "RETAILER" ? userId : null,
      });

      if (profileError) {
        results.push({ email: user.email, status: `profile_error: ${profileError.message}` });
      } else {
        results.push({ email: user.email, status: "created", userId });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
