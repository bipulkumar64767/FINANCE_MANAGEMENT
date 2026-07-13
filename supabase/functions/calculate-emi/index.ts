import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EMIScheduleItem {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  balance: number;
}

function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  return principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
}

function generateSchedule(principal: number, annualRate: number, tenureMonths: number): EMIScheduleItem[] {
  const monthlyRate = annualRate / 12 / 100;
  let emi = calculateEMI(principal, annualRate, tenureMonths);
  let balance = principal;
  const schedule: EMIScheduleItem[] = [];
  const today = new Date();

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = balance * monthlyRate;
    let principalComponent = emi - interest;

    if (i === tenureMonths) {
      principalComponent = balance;
      emi = principalComponent + interest;
    }

    balance -= principalComponent;
    const dueDate = new Date(today.getFullYear(), today.getMonth() + i, today.getDate());

    schedule.push({
      installmentNumber: i,
      dueDate: dueDate.toISOString().split("T")[0],
      amount: Math.round(emi * 100) / 100,
      principal: Math.round(principalComponent * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(Math.max(0, balance) * 100) / 100,
    });
  }

  return schedule;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { principal, annualRate, tenureMonths } = await req.json();

    if (!principal || !annualRate || !tenureMonths) {
      return new Response(JSON.stringify({ error: "Missing required fields: principal, annualRate, tenureMonths" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emi = calculateEMI(Number(principal), Number(annualRate), Number(tenureMonths));
    const schedule = generateSchedule(Number(principal), Number(annualRate), Number(tenureMonths));
    const totalPayable = schedule.reduce((sum, item) => sum + item.amount, 0);
    const totalInterest = totalPayable - Number(principal);

    return new Response(
      JSON.stringify({
        emi: Math.round(emi * 100) / 100,
        totalPayable: Math.round(totalPayable * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        principal: Number(principal),
        schedule,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
