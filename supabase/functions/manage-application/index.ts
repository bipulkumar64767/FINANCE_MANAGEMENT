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

    const body = await req.json();
    const { action, applicationId, comments, rejectionReason } = body;

    // Fetch the application
    const { data: app, error: appError } = await supabase
      .from("finance_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transitions: Record<string, { newStatus: string; allowedRoles: string[] }> = {
      SUBMIT: { newStatus: "SUBMITTED", allowedRoles: ["CUSTOMER", "RETAILER", "SUPER_ADMIN", "ADMIN"] },
      REVIEW: { newStatus: "UNDER_REVIEW", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
      APPROVE: { newStatus: "APPROVED", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
      REJECT: { newStatus: "REJECTED", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
      DISBURSE: { newStatus: "DISBURSED", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
    };

    const transition = transitions[action];
    if (!transition) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!transition.allowedRoles.includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Not authorized for this action" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = { status: transition.newStatus };
    if (action === "SUBMIT") updates.submitted_at = new Date().toISOString();
    if (action === "APPROVE") updates.approved_at = new Date().toISOString();
    if (action === "REJECT") { updates.rejection_reason = rejectionReason || comments || "Rejected"; }
    if (action === "DISBURSE") updates.disbursed_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("finance_applications")
      .update(updates)
      .eq("id", applicationId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert approval record
    await supabase.from("approvals").insert({
      application_id: applicationId,
      approver_id: user.id,
      approver_name: profile.full_name,
      action,
      comments: comments || null,
      previous_status: app.status,
      new_status: transition.newStatus,
    });

    // Generate EMI schedule on approval
    if (action === "APPROVE") {
      await supabase.rpc("generate_emi_schedule", { app_id: applicationId });
    }

    // Create notification for the customer
    const notifTitles: Record<string, { title: string; message: string; type: string }> = {
      SUBMIT: { title: "Application Submitted", message: `Your application ${app.application_number} has been submitted.`, type: "SUCCESS" },
      REVIEW: { title: "Application Under Review", message: `Your application ${app.application_number} is now under review.`, type: "INFO" },
      APPROVE: { title: "Application Approved!", message: `Congratulations! Application ${app.application_number} has been approved.`, type: "SUCCESS" },
      REJECT: { title: "Application Rejected", message: `Your application ${app.application_number} has been rejected. Reason: ${rejectionReason || comments || "N/A"}`, type: "ERROR" },
      DISBURSE: { title: "Loan Disbursed", message: `Your loan for application ${app.application_number} has been disbursed.`, type: "SUCCESS" },
    };

    const notif = notifTitles[action];
    if (notif) {
      await supabase.from("notifications").insert({
        user_id: app.customer_id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        read: false,
        link: `/applications/${applicationId}`,
      });
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_email: profile.email,
      user_role: profile.role,
      action: `APPLICATION_${action}`,
      entity_type: "finance_application",
      entity_id: applicationId,
      details: { application_number: app.application_number, previous_status: app.status, new_status: transition.newStatus, comments },
    });

    return new Response(
      JSON.stringify({ success: true, newStatus: transition.newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
