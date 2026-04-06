const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertHundreds(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) {
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
  }
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertHundreds(n % 100) : '');
}

export function numberToWords(amount: number): string {
  if (isNaN(amount) || amount < 0) return 'Zero Pesos Only';

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) return 'Zero Pesos Only';

  let result = '';

  if (integerPart >= 1_000_000) {
    result += convertHundreds(Math.floor(integerPart / 1_000_000)) + ' Million ';
  }
  if (integerPart >= 1_000) {
    result += convertHundreds(Math.floor((integerPart % 1_000_000) / 1_000)) + ' Thousand ';
  }
  result += convertHundreds(integerPart % 1_000);

  result = result.trim();
  result += ' Pesos';

  if (decimalPart > 0) {
    result += ' and ' + convertHundreds(decimalPart) + '/100';
  }

  result += ' Only';
  return result;
}
