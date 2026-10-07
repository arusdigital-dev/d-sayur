export function nextAddressLabel(addresses: Array<{ label?: string | null }>) {
  const used = new Set(
    addresses
      .map((address) => /^Alamat\s+(\d+)$/i.exec(address.label?.trim() ?? ""))
      .filter((match): match is RegExpExecArray => Boolean(match))
      .map((match) => Number(match[1])),
  );
  for (let number = 1; number <= addresses.length; number += 1) used.add(number);
  let number = 1;
  while (used.has(number)) number += 1;
  return `Alamat ${number}`;
}
