import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = profile.role;
    const stats: Record<string, unknown> = {};

    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      const [apps, customers, retailers, assets, emiData] = await Promise.all([
        supabase.from("finance_applications").select("status, finance_amount, total_payable, created_at"),
        supabase.from("profiles").select("id").eq("role", "CUSTOMER"),
        supabase.from("profiles").select("id").eq("role", "RETAILER"),
        supabase.from("assets").select("id, price"),
        supabase.from("emi_schedules").select("status, amount").in("status", ["PENDING", "OVERDUE"]),
      ]);

      const allApps = apps.data || [];
      const totalDisbursed = allApps.filter(a => a.status === "DISBURSED" || a.status === "APPROVED").reduce((s, a) => s + Number(a.finance_amount), 0);
      const pendingApprovals = allApps.filter(a => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;
      const totalReceivable = (emiData.data || []).reduce((s, e) => s + Number(e.amount), 0);

      stats.totalApplications = allApps.length;
      stats.pendingApprovals = pendingApprovals;
      stats.totalCustomers = customers.data?.length || 0;
      stats.totalRetailers = retailers.data?.length || 0;
      stats.totalAssets = assets.data?.length || 0;
      stats.totalDisbursed = totalDisbursed;
      stats.totalReceivable = totalReceivable;
      stats.applicationsByStatus = {
        DRAFT: allApps.filter(a => a.status === "DRAFT").length,
        SUBMITTED: allApps.filter(a => a.status === "SUBMITTED").length,
        UNDER_REVIEW: allApps.filter(a => a.status === "UNDER_REVIEW").length,
        APPROVED: allApps.filter(a => a.status === "APPROVED").length,
        REJECTED: allApps.filter(a => a.status === "REJECTED").length,
        DISBURSED: allApps.filter(a => a.status === "DISBURSED").length,
        CLOSED: allApps.filter(a => a.status === "CLOSED").length,
      };
    } else if (role === "RETAILER") {
      const [apps, customers] = await Promise.all([
        supabase.from("finance_applications").select("status, finance_amount, created_at").eq("retailer_id", user.id),
        supabase.from("finance_applications").select("customer_id").eq("retailer_id", user.id),
      ]);

      const allApps = apps.data || [];
      const uniqueCustomers = new Set((customers.data || []).map(c => c.customer_id));

      stats.totalApplications = allApps.length;
      stats.pendingApprovals = allApps.filter(a => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;
      stats.approvedApplications = allApps.filter(a => a.status === "APPROVED" || a.status === "DISBURSED").length;
      stats.totalCustomers = uniqueCustomers.size;
      stats.totalFinanceAmount = allApps.reduce((s, a) => s + Number(a.finance_amount), 0);
      stats.applicationsByStatus = {
        DRAFT: allApps.filter(a => a.status === "DRAFT").length,
        SUBMITTED: allApps.filter(a => a.status === "SUBMITTED").length,
        UNDER_REVIEW: allApps.filter(a => a.status === "UNDER_REVIEW").length,
        APPROVED: allApps.filter(a => a.status === "APPROVED").length,
        REJECTED: allApps.filter(a => a.status === "REJECTED").length,
        DISBURSED: allApps.filter(a => a.status === "DISBURSED").length,
      };
    } else {
      // CUSTOMER
      const { data: custApps } = await supabase
        .from("finance_applications")
        .select("id, status, finance_amount, monthly_emi, asset_name, application_number")
        .eq("customer_id", user.id);
      const allApps = custApps || [];
      const activeLoans = allApps.filter((a: Record<string, unknown>) => a.status === "DISBURSED" || a.status === "APPROVED");
      const activeAppIds = activeLoans.map((a: Record<string, unknown>) => a.id);

      let nextEMI: { amount: number; due_date: string } | null = null;
      if (activeAppIds.length > 0) {
        const { data: emiRows } = await supabase
          .from("emi_schedules")
          .select("status, amount, due_date")
          .in("application_id", activeAppIds)
          .eq("status", "PENDING")
          .order("due_date", { ascending: true })
          .limit(1);
        nextEMI = (emiRows && emiRows.length > 0) ? { amount: Number(emiRows[0].amount), due_date: emiRows[0].due_date } : null;
      }

      stats.totalApplications = allApps.length;
      stats.activeLoans = activeLoans.length;
      stats.pendingApplications = allApps.filter((a: Record<string, unknown>) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW" || a.status === "DRAFT").length;
      stats.totalBorrowed = activeLoans.reduce((s: number, a: Record<string, unknown>) => s + Number(a.finance_amount), 0);
      stats.monthlyEMI = activeLoans.reduce((s: number, a: Record<string, unknown>) => s + Number(a.monthly_emi), 0);
      stats.nextEMIDue = nextEMI ? { amount: nextEMI.amount, dueDate: nextEMI.due_date } : null;
      stats.applicationsByStatus = {
        DRAFT: allApps.filter((a: Record<string, unknown>) => a.status === "DRAFT").length,
        SUBMITTED: allApps.filter((a: Record<string, unknown>) => a.status === "SUBMITTED").length,
        UNDER_REVIEW: allApps.filter((a: Record<string, unknown>) => a.status === "UNDER_REVIEW").length,
        APPROVED: allApps.filter((a: Record<string, unknown>) => a.status === "APPROVED").length,
        REJECTED: allApps.filter((a: Record<string, unknown>) => a.status === "REJECTED").length,
        DISBURSED: allApps.filter((a: Record<string, unknown>) => a.status === "DISBURSED").length,
      };
    }

    return new Response(
      JSON.stringify({ success: true, role, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
