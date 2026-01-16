import { uniq, asArray, sum } from "../utils/helpers.js";

export function buildCryptoProfile(cryptoInfo) {
  const cryptoAddresses = asArray(cryptoInfo?.addresses);
  if (!cryptoAddresses.length) return null;

  const totalTx = sum(cryptoAddresses.map((a) => a?.tx_count));
  const totalBalance = sum(cryptoAddresses.map((a) => a?.balance || 0));

  return {
    address_count: cryptoAddresses.length,
    total_tx: totalTx,
    total_balance: totalBalance,
    chains: uniq(cryptoAddresses.map((a) => a?.chain).filter(Boolean)),
    activity_level:
      totalTx > 100
        ? "high"
        : totalTx > 10
          ? "medium"
          : totalTx > 0
            ? "low"
            : "none",
  };
}
