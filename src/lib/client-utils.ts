type ClientWithSales = {
  sales: {
    installments: { value: unknown }[];
  }[];
};

export function getClientBalance(client: ClientWithSales) {
  let balance = 0;
  for (const sale of client.sales) {
    for (const inst of sale.installments) {
      balance += Number(inst.value);
    }
  }
  return balance;
}
