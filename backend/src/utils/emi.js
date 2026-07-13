export function calculateEMI(principal, annualRate, tenureMonths) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  );
}

export function generateSchedule(principal, annualRate, tenureMonths) {
  const monthlyRate = annualRate / 12 / 100;
  let emi = calculateEMI(principal, annualRate, tenureMonths);
  let balance = principal;
  const schedule = [];
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
      installment_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      amount: Math.round(emi * 100) / 100,
      principal: Math.round(principalComponent * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(Math.max(0, balance) * 100) / 100,
      status: 'PENDING',
    });
  }

  return schedule;
}

export function emiPreview(principal, annualRate, tenureMonths) {
  const schedule = generateSchedule(principal, annualRate, tenureMonths);
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const totalPayable = schedule.reduce((sum, item) => sum + item.amount, 0);
  const totalInterest = totalPayable - principal;

  return {
    emi: Math.round(emi * 100) / 100,
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    principal: Number(principal),
    schedule: schedule.map((s) => ({
      installmentNumber: s.installment_number,
      dueDate: s.due_date,
      amount: s.amount,
      principal: s.principal,
      interest: s.interest,
      balance: s.balance,
    })),
  };
}
