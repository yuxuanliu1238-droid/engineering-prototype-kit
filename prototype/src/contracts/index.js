import { starterHome } from "./data/starter.js";

export const PAGE_CONTRACTS = Object.freeze([starterHome]);

export function getPageContract(pageId) {
  return PAGE_CONTRACTS.find((contract) => contract.pageId === pageId) || null;
}
