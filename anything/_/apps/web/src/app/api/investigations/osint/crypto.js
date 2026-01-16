import { safeFetch } from "./helpers.js";

export async function cryptoIntel(addresses) {
  const items = [];
  for (const addr of addresses) {
    const type = detectCryptoType(addr);
    const item = { address: addr, type };
    try {
      if (type === "ETH") {
        const r = await safeFetch(
          `https://api.blockcypher.com/v1/eth/main/addrs/${addr}`,
        );
        if (r.ok) {
          const j = await r.json();
          item.tx_n = j.n_tx;
          item.balance = j.balance; // in wei
          item.final_balance = j.final_balance;
        }
      } else if (type === "BTC") {
        const r = await safeFetch(
          `https://api.blockcypher.com/v1/btc/main/addrs/${addr}`,
        );
        if (r.ok) {
          const j = await r.json();
          item.tx_n = j.n_tx;
          item.balance = j.balance; // in satoshis
          item.final_balance = j.final_balance;
        }
      }
    } catch (e) {
      item.error = e.message;
    }
    items.push(item);
  }
  return { items };
}

export function detectCryptoType(s) {
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return "ETH";
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(s)) return "BTC";
  return "unknown";
}

export function extractCryptoFromHtml(html) {
  const set = new Set();
  const eth = html.match(/0x[a-fA-F0-9]{40}/g) || [];
  eth.forEach((a) => set.add(a));
  const btc = html.match(/(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}/g) || [];
  btc.forEach((a) => set.add(a));
  return Array.from(set);
}
