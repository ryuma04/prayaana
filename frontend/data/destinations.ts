import type { Destination } from "@/types";
import { destinationMap } from "./catalog";

export { destinations, destinationMap } from "./catalog";

export const getDestination = (id: string): Destination | undefined => destinationMap[id];

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
