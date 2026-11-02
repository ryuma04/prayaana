import { ChatMessage } from "../types";
import { travelGuruService } from "./travelGuruService";
import { post } from "@/lib/api/client";

export const quickAiService = {
  /**
   * Real AI answer from the Prayaana backend (Nugen aligned travel model first, then Groq / Gemini),
   * grounded in the Prayaana Karnataka catalog. Falls back to the offline tips below only when the server can't answer.
   */
  async chat(message: string, cityContext?: string): Promise<ChatMessage> {
    try {
      const res = await post<{ answer: string; engine: string }>("/assistant/ask", { question: message, city: cityContext ?? "" });
      if (res.answer?.trim()) {
        return { id: `msg-${Date.now()}`, role: "assistant", content: res.answer.trim(), timestamp: new Date().toISOString() };
      }
    } catch {
      /* offline or not signed in: use the local tips */
    }
    return this.offline(message, cityContext);
  },

  /** Offline tips from the built-in city guide (no AI). */
  async offline(message: string, cityContext?: string): Promise<ChatMessage> {
    const activeCity = cityContext || "Bengaluru";
    const cityInfo = travelGuruService.getCityInfo(activeCity);
    const lower = message.toLowerCase();

    let content = "";

    // 1. Food & Eating
    if (
      lower.includes("restaurant") ||
      lower.includes("eat") ||
      lower.includes("food") ||
      lower.includes("lunch") ||
      lower.includes("dinner") ||
      lower.includes("breakfast") ||
      lower.includes("thali") ||
      lower.includes("hungry")
    ) {
      const foodPlaces = cityInfo.places.filter(p => p.category === "Food & Markets" || p.category === "Cultural & Spiritual");
      const p1 = foodPlaces[0] || cityInfo.places[0];
      const p2 = foodPlaces[1] || cityInfo.places[1] || p1;
      const specialties = cityInfo.famousFood ? cityInfo.famousFood.slice(0, 3).join(", ") : "regional thalis and street snacks";

      content = `Based on your stay in **${cityInfo.name}**, here are top culinary recommendations:\n\n` +
        `🍽 **${p1.name}** – Approx ₹${p1.approxCost || 250}/person\n` +
        `   *${p1.description.slice(0, 110)}...*\n\n` +
        `🥘 **${p2.name}** – Approx ₹${p2.approxCost || 250}/person\n` +
        `   *${p2.description.slice(0, 110)}...*\n\n` +
        `✨ **Must-try local dishes:** ${specialties}.\n\n` +
        `Would you like to add these to your trip plan?`;
    }
    // 2. Free Time / Sightseeing
    else if (
      lower.includes("free time") ||
      lower.includes("explore") ||
      lower.includes("what to do") ||
      lower.includes("hours") ||
      lower.includes("places") ||
      lower.includes("sightseeing")
    ) {
      const sights = cityInfo.places.slice(0, 3);
      content = `You have free time in **${cityInfo.name}**! Here are the best spots to explore:\n\n` +
        sights.map((p, i) => `${i + 1}. 🏛 **${p.name}** – ${p.entryFee}, ~${p.durationHours || 2} hrs\n   *${p.insiderTip || p.description.slice(0, 90)}*`).join("\n\n") +
        `\n\nAll of these fit comfortably into your afternoon or evening schedule!`;
    }
    // 3. Reschedule / Time Shifting
    else if (
      lower.includes("meeting") ||
      lower.includes("move") ||
      lower.includes("reschedule") ||
      lower.includes("shift") ||
      lower.includes("time") ||
      lower.includes("late")
    ) {
      content = `I can help reschedule your **${cityInfo.name}** itinerary!\n\n` +
        `**Proposed Adjustments:**\n` +
        `• Primary Sightseeing → Shifted +1.5 hrs\n` +
        `• Travel Buffer & Chai Stop → 30 mins\n` +
        `• Evening Golden Hour Point → 5:30 PM – 7:00 PM\n` +
        `• Dinner & Night Bazaar → 8:30 PM\n\n` +
        `Would you like to lock this into your schedule?`;
    }
    // 4. Budget / Cost Reduction
    else if (
      lower.includes("budget") ||
      lower.includes("reduce") ||
      lower.includes("save") ||
      lower.includes("cheaper") ||
      lower.includes("cost")
    ) {
      content = `Here is how you can optimize your travel budget in **${cityInfo.name}**:\n\n` +
        `✅ **Free Entry Attractions:** Visit top heritage temples & waterfront promenades (saves ~₹500/day)\n` +
        `✅ **Local Transit:** Use day cab passes, metro or shared auto-rickshaws instead of app cabs (saves ~₹800/day)\n` +
        `✅ **Lunch Thalis:** Opt for authentic regional thalis at lunch for unlimited multi-dish courses at under ₹300\n\n` +
        `Total estimated daily savings: **₹1,500 – ₹2,500+**!`;
    }
    // 5. Vegetarian / Diet Preferences
    else if (
      lower.includes("vegetarian") ||
      lower.includes("veg") ||
      lower.includes("jain") ||
      lower.includes("plant")
    ) {
      const foodPlaces = cityInfo.places.filter(p => p.category === "Food & Markets" || p.category === "Cultural & Spiritual");
      const pick = foodPlaces[0] || cityInfo.places[0];
      content = `Great! Here are the best pure-veg and vegetarian dining options in **${cityInfo.name}**:\n\n` +
        `🌿 **${pick.name}** – Top-rated pure vegetarian dining (Rating: ${pick.rating} ⭐)\n` +
        `   *Tip: ${pick.insiderTip || "Ask for fresh seasonal regional preparations"}*\n\n` +
        `🍃 **Old City Traditional Eateries** – Famous for authentic meat-free local snacks, sweets and thalis.\n\n` +
        `Would you like directions or timings for these?`;
    }
    // 6. Emergency Assistance
    else if (
      lower.includes("emergency") ||
      lower.includes("lost") ||
      lower.includes("hospital") ||
      lower.includes("police") ||
      lower.includes("help") ||
      lower.includes("danger")
    ) {
      const contacts = cityInfo.emergencyContacts || [
        { name: "National Emergency", number: "112", type: "All Services" },
        { name: "Police", number: "100", type: "Police" },
        { name: "Ambulance", number: "108", type: "Medical" }
      ];

      content = `⚠️ **Emergency Assistance for ${cityInfo.name}**\n\n` +
        `Please reach out to official services immediately:\n\n` +
        contacts.map(c => `🚨 **${c.name}:** \`${c.number}\` (${c.type})`).join("\n") +
        `\n\n📍 *Nearest government civil hospitals & police stations operate 24/7. Always dial 112 for urgent help.*`;
    }
    // 7. Default
    else {
      content = `I'm **Travel Guru AI**, your personal tour guide for **${cityInfo.name}**! 🧭\n\n` +
        `I can help you dynamically with:\n` +
        `• 🍽 Best regional eateries & street food trails\n` +
        `• 🏛 Iconic forts, monuments & secret offbeat gems\n` +
        `• 🗓 Custom 1-day or multi-day itineraries\n` +
        `• 💰 Daily budget calculations & cost-saving hacks\n` +
        `• 🌤 Real-time weather advisories & emergency help\n\n` +
        `What would you like to explore in **${cityInfo.name}** right now?`;
    }

    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content,
      timestamp: new Date().toISOString()
    };
  }
};
