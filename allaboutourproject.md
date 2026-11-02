# Trizpyy: All About Our Project

**Plan your own trip. We handle the changes.**

This one file explains our whole hackathon project from zero to finish:

- the problem statement and what it means
- who uses our product and what problems they face today
- the features we must build and the special features that make us win
- the AI plan, the tech stack and the system design
- the screens, the design style, the demo script, the pitch rules and the build plan

Everything is written in simple English. When a technical word appears, it is explained right away or in the Glossary at the end.

---

## Table of contents

1. [The project in one minute](#1-the-project-in-one-minute)
2. [The problem statement (exact words + simple explanation)](#2-the-problem-statement-exact-words--simple-explanation)
3. [Real facts that prove the problem](#3-real-facts-that-prove-the-problem)
4. [Who uses our platform](#4-who-uses-our-platform)
5. [What today's tools miss](#5-what-todays-tools-miss)
6. [Our solution: one platform, three parts](#6-our-solution-one-platform-three-parts)
7. [The full trip journey: 11 steps](#7-the-full-trip-journey-11-steps)
8. [Must-build features (required by the problem statement)](#8-must-build-features-required-by-the-problem-statement)
9. [Hero features (our "wow" features)](#9-hero-features-our-wow-features)
10. [Extra features (if time allows)](#10-extra-features-if-time-allows)
11. [Our open-source packages (SDK) and MCP server](#11-our-open-source-packages-sdk-and-mcp-server)
12. [How the smart parts work](#12-how-the-smart-parts-work)
13. [AI plan: Groq, Jev and Python](#13-ai-plan-groq-jev-and-python)
14. [WhatsApp plan: how we use it (almost free)](#14-whatsapp-plan-how-we-use-it-almost-free)
15. [Final tech stack](#15-final-tech-stack)
16. [System architecture](#16-system-architecture)
17. [Folder structure](#17-folder-structure)
18. [Database design](#18-database-design)
19. [API design](#19-api-design)
20. [Outside services and their limits](#20-outside-services-and-their-limits)
21. [All screens](#21-all-screens)
22. [UI and UX design: which style wins and why](#22-ui-and-ux-design-which-style-wins-and-why)
23. [Demo script for the judges (7 minutes)](#23-demo-script-for-the-judges-7-minutes)
24. [Pitch rules and judge questions](#24-pitch-rules-and-judge-questions)
25. [Build plan and team roles](#25-build-plan-and-team-roles)
26. [Risks and backup plans](#26-risks-and-backup-plans)
27. [Business model and impact](#27-business-model-and-impact)
28. [What already exists in this folder](#28-what-already-exists-in-this-folder)
29. [Glossary](#29-glossary)
30. [Sources](#30-sources)

---

## 1. The project in one minute

**Trizpyy** is a travel platform with two sides that work together.

**For travelers**
- You tell us what you like, in a short quiz or in your own words.
- We build a complete custom trip for you in seconds.
- You can change any part, compare options and see the price update live.
- You book it and get help during the trip, including on WhatsApp.

**For tour operators (travel companies)**
- One screen to run many custom trips at the same time.
- It covers customers, bookings, hotels, drivers, activity partners, payments, groups, guides and schedules.

### Our USP (the one thing that makes us different)

> **Trizpyy is the travel platform where a broken trip fixes itself.**
> When a flight is late, it rains, or a hotel is overbooked, our AI agent:
> 1. finds everything that the change affects
> 2. makes 3 fix plans
> 3. checks them for safety in half a second using Jev
> 4. asks every affected vendor on WhatsApp (they can even reply by voice note)
> 5. applies the change only when every vendor says yes
> 6. tells the traveler in plain words what changed

Today this work takes operators hours of calls and WhatsApp messages. With Trizpyy it takes minutes, and you can watch every step live on screen.

---

## 2. The problem statement (exact words + simple explanation)

### 2.1 The official problem statement (exact text)

> **Personalized Dynamic Tour Planning & Tour Operations Platform**
>
> **Problem Statement**
>
> Traditional tour operators typically offer pre-designed packages with fixed destinations, hotels, transportation, activities, schedules, and pricing. While such packages simplify tour management, they provide limited flexibility for travelers who have different interests, budgets, travel durations, accommodation preferences, activity choices, and preferred travel styles. Modern travelers increasingly expect to customize their journeys rather than simply select from predefined packages.
>
> At the same time, delivering personalized tours creates significant operational challenges for tour operators. They need to coordinate customers, hotels, transportation providers, activity vendors, tour coordinators, payments, schedules, group participants, and itinerary changes. When a traveler modifies a requirement or an unexpected situation occurs during the journey, operators may need to manually coordinate multiple stakeholders and update several parts of the itinerary, making the process inefficient and difficult to manage.
>
> **Hackathon Challenge**
>
> Design and prototype a personalized and dynamic tour planning and operations platform that connects travelers and tour operators through a single system and supports the complete lifecycle of a customized tour. The platform should allow travelers to define their destination preferences, travel dates, duration, budget, accommodation preferences, transportation choices, interests, activities, and preferred travel style, and then create and customize their own tour rather than being restricted to a fixed package. Travelers should be able to explore destinations and experiences, select and modify different components of their trip, compare alternatives, view estimated costs, receive an optimized itinerary, complete bookings, and access their complete travel plan.
>
> The platform should also provide tour operators with a centralized environment to manage the operational side of personalized tours, including customers, bookings, vendors, hotels, transportation, activities, payments, tour groups, coordinators, schedules, and itinerary changes. The system should provide visibility into both the customer-facing journey and the operator-facing operations, allowing operators to efficiently manage multiple customized tours and coordinate the different service providers involved.
>
> A key aspect of the challenge is dynamic tour management. Travel plans can change before or during a tour because of traveler preferences, availability issues, cancellations, delays, weather, or other unexpected situations. The platform should be able to identify the impact of such changes and help travelers or operators modify the itinerary while considering factors such as cost, availability, timing, location, dependencies, and traveler preferences.
>
> Teams may use AI, recommendation systems, optimization, conversational interfaces, or intelligent automation to provide personalized destination and activity recommendations, generate and optimize itineraries, manage budgets, detect conflicts, suggest alternatives, and provide assistance during the journey.
>
> The complete journey can be represented as:
> Discover → Personalize → Plan → Price → Book → Prepare → Operate → Assist → Adapt → Complete → Review
>
> The challenge is to demonstrate how technology can help tour operators move beyond fixed-package tourism toward a more personalized, flexible, and dynamically managed travel experience, while giving operators the operational visibility and control required to manage the entire tour lifecycle.

### 2.2 What it means, part by part (simple explanation)

**Part 1: The old way does not fit people anymore**
- Travel companies sell fixed packages: the same places, hotels, transport, activities, timings and price for everyone.
- This is easy for the company but bad for travelers, because every person has different interests, budget, number of days, hotel taste and travel style.
- Travelers now want to design their own trip.

**Part 2: Custom trips are hard to run**
- A custom trip has many moving parts: the customer, hotels, transport, activity partners, the tour guide, payments, the schedule and the group members.
- When the traveler changes something, or something unexpected happens, staff must call and message many people and update many parts of the plan by hand.
- This is slow, error-prone and stressful.

**Part 3: What we must build (the challenge)**
- **One system** that connects travelers and tour operators.
- It must support **the whole life of a custom trip**, from the first idea to the final review.

**Part 4: What travelers must be able to do**
- Tell us their preferences: destination, dates, number of days, budget, hotel type, transport, interests, activities and travel style.
- Build their own trip instead of choosing a fixed package.
- Explore destinations and experiences.
- Pick and change parts of the trip, and compare options.
- See the estimated cost.
- Get an optimized plan (the best order and timing).
- Book the trip and see the complete travel plan at any time.

**Part 5: What operators must be able to do**
- Manage everything from one central place: customers, bookings, vendors, hotels, transport, activities, payments, groups, coordinators, schedules and changes.
- See both sides: what the traveler experiences and what the operations team must do.
- Run many custom trips at once and coordinate all service providers.

**Part 6: The most important part: changes (dynamic tour management)**
- Plans change before or during the trip because of changes of mind, sold-out items, cancellations, delays, weather or surprises.
- The system must **find the impact** of the change: what else breaks because of it.
- It must **help fix the plan** while thinking about cost, availability, time, location, links between plan items ("dependencies") and what the traveler likes.

**Part 7: AI is welcome**
- We may use AI, recommendations, optimization, chat or automation for:
  - personal suggestions
  - making and improving plans
  - budgets
  - finding conflicts
  - suggesting alternatives
  - helping during the trip

**Part 8: The 11-step journey we must cover**
- Discover → Personalize → Plan → Price → Book → Prepare → Operate → Assist → Adapt → Complete → Review.

**Part 9: The goal**
- Show how technology helps operators move from fixed packages to flexible custom trips, while keeping full visibility and control.

### 2.3 How Trizpyy answers every requirement

| Requirement in the problem statement | How Trizpyy does it |
|---|---|
| Travelers set preferences (destination, dates, duration, budget, hotel, transport, interests, activities, style) | 60-second taste quiz + "describe your trip in your own words" box |
| Build and customize their own tour | Trip builder: swap, add, remove, move any item |
| Explore destinations and experiences | Discover screen, destination pages, search by feeling |
| Compare alternatives | Compare sheet for every item (price, time, distance, rating, rain safety) |
| View estimated costs | Live price panel with full breakdown and budget meter |
| Receive an optimized itinerary | Route and time optimizer (Google OR-Tools) |
| Complete bookings | Checkout with Razorpay (test mode) and vendor confirmations on WhatsApp |
| Access the complete travel plan | My Trip page + offline Trip Pass + WhatsApp updates |
| Operator central environment | Operator console: tours, bookings, customers, vendors, payments, groups, coordinators, schedules, changes |
| Visibility of both sides | Operator can open any trip and see the traveler's view + the operations view |
| Manage many custom tours | Live tour timeline with status and risk for every tour |
| Coordinate service providers | All-or-Nothing Vendor Confirmation on WhatsApp |
| Identify impact of changes | Change Impact Map |
| Modify itinerary considering cost, availability, time, location, dependencies, preferences | 3 Fix Plans + Must-Do Hearts + Trip Fixer Agent |
| AI recommendations, itinerary generation, budgets, conflicts, alternatives, assistance | Jev Match, planner, budget meter, conflict checks, fix plans, WhatsApp trip assistant |
| Full 11-step journey | Every step has a screen and a feature (see Section 7) |

---

## 3. Real facts that prove the problem

**Travelers want custom trips**
- 86% of travelers actively look for personalization when planning. Custom packages grew from 3% to 17% of tour operator revenue between 2022 and 2023. ([MyTrip.AI](https://mytrip.ai/50-largest-challenges-to-travel-agencies-tour-operators-activity-providers-in-2025/))
- Bookings made within 3 days of the experience grew by 52%. People book late and expect instant answers. ([MyTrip.AI](https://mytrip.ai/50-largest-challenges-to-travel-agencies-tour-operators-activity-providers-in-2025/))

**Operators work by hand**
- Many operators run on WhatsApp threads, email chains and spreadsheets, which stop working as they grow. Confirmations sent by WhatsApp leave no proper record. ([Automate.travel](https://automate.travel/learn/what-is-tour-operator-software/), [PHPTRAVELS](https://phptravels.com/blog/tour-operator-crm))
- One custom itinerary can take up to a few hours to build, and availability is checked by manual calls and emails. ([Lemax](https://lemax.net/blog/fit-travel-two-most-common-pains-tour-operators-face-and-how-technology-can-solve-them/))
- Agents using manual methods make only about 3.5 quotes per day. ([MyTrip.AI](https://mytrip.ai/50-largest-challenges-to-travel-agencies-tour-operators-activity-providers-in-2025/))
- In multi-day trips, one problem spreads across the whole schedule. ([MyTrip.AI](https://mytrip.ai/50-largest-challenges-to-travel-agencies-tour-operators-activity-providers-in-2025/))

**Changes and disruptions happen all the time**
- Indian domestic airlines delayed over 14% of flights in the peak months of 2025, about 1 in 7 flights. In October 2025 alone, 104,204 passengers faced delays of more than 2 hours. ([Deepmode](https://deepmode.substack.com/p/indian-domestic-airline-market-2025), [HappyFares](https://www.happyfares.in/blog/flight-delay-rights-india-2026/))
- In December 2025, IndiGo cancelled nearly 4,500 flights in 10 days, affecting more than 10 lakh passengers. ([Wikipedia](https://en.wikipedia.org/wiki/2025_IndiGo_disruption))
- In the 2025 monsoon, 842 roads, including 3 national highways, were blocked by landslides in Himachal Pradesh. About 2,500 tourists were stuck in Mussoorie when the road closed. ([The Tribune](https://www.tribuneindia.com/news/himachal/roads-closed-bridges-damaged-as-himachal-battles-monsoon-havoc-one-killed-2-injured/), [The Tribune](https://www.tribuneindia.com/news/uttarakhand/rain-fury-2500-tourists-stuck-in-uttarakhands-mussoorie))
- Around the world, nearly 1 in 4 US flights ran late in 2025, and 89% of US travelers now expect a delay or cancellation. ([The Traveler](https://www.thetraveler.org/nearly-1-in-4-flights-ran-late-in-2025-as-2026-risks-mount/), [Fortune](https://fortune.com/2026/05/19/89-travelers-disruptions-top-concern-paying-more-summer-travel/))

**Groups fight about money and decisions**
- Nearly half of group travelers have fought about money on a trip (CIT Bank, June 2026).
- Only 1 in 4 friend groups set a budget before planning (Experian, June 2025).
- ([SquadTrip](https://www.squadtrip.com/guides/how-to-make-group-travel-decisions-without-conflict/), [WePlanify](https://www.weplanify.com/en/blog/group-trip-budget))

**In India, everyone is on WhatsApp and people send voice notes**
- India has about 535.8 million WhatsApp users. 78% of Indian small businesses use WhatsApp for business. ([Hyperleap](https://hyperleap.ai/blog/whatsapp-statistics-india-2026))
- Voice notes are a default way of talking in India, and over 7 billion voice messages are sent every day worldwide. ([Hyperleap](https://hyperleap.ai/blog/whatsapp-business-statistics-2026))
- **What this means for us:** drivers, hotels and homestays already reply on WhatsApp, often by voice. Our product must work inside WhatsApp and understand voice notes.

### The problem in one sentence

> Travelers want trips made for them, but operators cannot run many custom trips by hand, and every change today means hours of calls and WhatsApp messages with many vendors.

---

## 4. Who uses our platform

| User | Who they are | What they want | Where they use Trizpyy |
|---|---|---|---|
| **Traveler** | A person, couple, family or group planning a trip | A trip that fits them, clear prices, easy booking, help when things change | Traveler app (works like an app on the phone) + WhatsApp |
| **Operator staff** | People at a travel company who sell and run trips | See all trips in one place, fix problems fast, keep vendors in sync, track money | Operator console (web dashboard) |
| **Tour coordinator / guide** | The person in the field with the group | Know today's plan, report problems, get quick fixes | Coordinator view + WhatsApp |
| **Vendor** | Hotel, homestay, driver, cab company, activity partner | Get clear requests and reply fast, with no new app | WhatsApp (buttons or voice note) + a simple one-page link |

---

## 5. What today's tools miss

| Tool type | Examples | What they do well | What they miss |
|---|---|---|---|
| AI trip planners (for travelers) | Mindtrip, Layla, Wanderlog | Nice plans, maps, some live prices. Mindtrip can book flights inside chat. | No operator side. They do not coordinate hotels, drivers and activity partners. They do not repair a booked trip with many vendors. |
| Tour operator software (for companies) | Lemax, Tourplan, TourCMS, Rezdy and others | Quotes, bookings, supplier lists, invoices | Changes are mostly manual. No live impact view. No automatic vendor confirmation with safe undo. |
| Flight disruption tools | Hopper Disruption Assistance | Rebooks flights when they are delayed | Flights only. Hotels, transfers and activities are not fixed. |
| Plain WhatsApp groups | Used by almost every operator | Everyone already uses it | No structure, no record, messages get missed, no impact view |

Sources: [AI planner comparison](https://www.travelanywhere.blog/blog/best-agentic-ai-travel-apps-2026-mindtrip-layla-stippl-stardrift-wanderlog-tested), [Layla tier list](https://layla.ai/blog/news-and-tips/ai-trip-planners-tier-list), [Operator software list](https://www.travelbooster.com/blog_post/the-best-tour-operator-software/), [Hopper](https://hts.hopper.com/products/disruption-assistance).

**The gap we fill:** Nobody connects the traveler, the operator and every vendor in one loop that does all of this:
1. finds the impact of a change
2. plans the fixes
3. gets every vendor's "yes" on WhatsApp
4. updates everyone automatically

This loop is our core idea.

---

## 6. Our solution: one platform, three parts

1. **Traveler app** (Next.js, mobile-first, can be installed on the phone)
   - Taste quiz → custom plan → change anything → live price → book → prep checklist → live trip help → fixes → review.
2. **Operator console** (Next.js dashboard)
   - All tours, bookings, customers, vendors, hotels, transport, activities, payments, groups, guides, schedules.
   - A live list of problems with fix plans and the agent's steps.
3. **WhatsApp for vendors and travelers** (official WhatsApp Business Platform)
   - **Vendors** get clear requests with buttons: "Can you move this booking from Tuesday 9 am to Thursday 9 am?" [Yes] [No] [Other time]. They can also reply with a voice note.
   - **Travelers** get trip updates and can message or send a voice note to get help, for example "We are stuck in traffic".
   - Every message also has a short web link as a backup.

All three parts are connected through our Go backend in real time. When one changes, the others update within seconds.

---

## 7. The full trip journey: 11 steps

| Step | What the traveler does | What the operator sees | Features used |
|---|---|---|---|
| 1. Discover | Browses destinations and experiences, searches by feeling ("quiet mountains, good food") | Popular destinations, demand by date | Destination cards, search by feeling, match score |
| 2. Personalize | Takes a 60-second quiz or types their wishes in their own words | Customer profile | Taste quiz ("Travel DNA"), Jev Match |
| 3. Plan | Gets a full day-by-day plan in seconds, then swaps, adds, removes, moves items and gives hearts to must-dos | Draft trips | Planner, compare options, Must-Do Hearts, energy meter, map |
| 4. Price | Sees the price change live, applies promo codes, sees budget left | Profit per trip | Price calculator, budget meter, flex-date saver |
| 5. Book | Pays (test mode) and gets a confirmation | New booking appears live. Vendors get WhatsApp requests. | Checkout, vendor confirmation |
| 6. Prepare | Gets a smart packing and documents checklist based on weather and activities | Trip readiness status | Prep checklist, offline Trip Pass |
| 7. Operate | Trip goes live: today's plan, live map, guide contact | Live view of every running tour | Live trip screen, tour timeline |
| 8. Assist | Taps a mood button or sends a WhatsApp voice note ("I'm tired") | Traveler requests | Mood buttons, WhatsApp trip assistant |
| 9. Adapt | Sees the fix when a flight is late or it rains, and approves it | Change Impact Map, 3 fix plans, agent steps, vendor replies | Trip Fixer Agent, Fix Plans, Vendor Confirmation |
| 10. Complete | Trip ends with a summary | Trip closed, vendor payments settled | Trip story, payouts |
| 11. Review | Rates the trip, the guide and the vendors | Ratings update vendor trust scores | Reviews, vendor trust score |

---

## 8. Must-build features (required by the problem statement)

These are not optional. Judges will check every one. Tick them off as we build.

### 8.1 Traveler side

- [ ] **Set preferences:** destination, dates, number of days, budget, hotel type, transport, interests, activities, travel style or pace.
- [ ] **Explore** destinations and experiences (cards, details, ratings).
- [ ] **Build their own trip**, not a fixed package.
- [ ] **Change any part:** swap, add, remove or move activities, hotel, transport.
- [ ] **Compare options** side by side: price, time, distance, rating, weather safety.
- [ ] **See estimated costs** that update live, with a full breakdown.
- [ ] **Get an optimized plan:** the order and timing that saves travel time and respects opening hours.
- [ ] **Book the trip** (payment in test mode).
- [ ] **See the full travel plan** at any time, even offline.

### 8.2 Operator side

- [ ] **One central console** for customers, bookings, vendors, hotels, transport, activities, payments, tour groups, coordinators, schedules and itinerary changes.
- [ ] **See both sides:** what the traveler sees and what operations must do.
- [ ] **Run many custom tours at once** with a clear status for each.
- [ ] **Coordinate vendors:** send requests, track replies, keep a record.

### 8.3 Changes and disruptions

- [ ] Handle changes **before and during** the trip: traveler changes, sold-out items, cancellations, delays, weather.
- [ ] **Find the impact** of a change: what it affects, in what order, and at what cost.
- [ ] **Help fix the plan** while thinking about cost, availability, time, location, links between items and traveler preferences.

### 8.4 AI help (the problem statement suggests it; we do all of it)

- [ ] Personal destination and activity suggestions.
- [ ] Create and optimize itineraries.
- [ ] Manage budgets.
- [ ] Find conflicts.
- [ ] Suggest alternatives.
- [ ] Help during the journey (chat and voice, in the app and on WhatsApp).

### 8.5 The full journey

- [ ] All 11 steps from Section 7 work from start to end in the demo.

---

## 9. Hero features (our "wow" features)

These 8 features are what judges will remember. Each one solves a real problem from Section 3. We build and demo all of them.

### Hero 1: Trip Fixer Agent (agentic AI, the "magic" moment)

- **What it is:** An AI agent that handles a problem from start to end on its own, inside safe rules. You can watch every step live on the operator screen.
- **What it does, step by step:**
  1. Notices a problem: a weather alert, a flight delay, a traveler's WhatsApp message, a vendor saying no, or a crowd report.
  2. Understands it: what kind of problem it is and how serious (Jev decides this in about 0.1 seconds).
  3. Finds the impact: which parts of the trip break.
  4. Makes 3 fix plans.
  5. Checks the best plan with 10 safety checks in under half a second (Jev + code).
  6. Asks every affected vendor on WhatsApp.
  7. Reads their replies, including voice notes.
  8. If someone says no, it undoes the change safely and tries the next plan.
  9. When everyone says yes, it applies the change and messages the traveler in plain words.
- **Safe rules:** The agent acts alone only when all of these are true:
  - the extra cost is below a limit (for example ₹500)
  - no hearted item is lost
  - every safety check passes

  Otherwise it asks the traveler or operator for a one-tap approval. After 2 failed tries, it calls a human coordinator.
- **Why it matters:** This is exactly the "coordinate multiple stakeholders and update several parts of the itinerary" work that the problem statement says is slow today.
- **Demo moment:** The operator clicks "Let the agent fix it". The screen shows a live timeline:
  - "Checking weather… 2 outdoor items affected"
  - "3 fix plans ready"
  - "10 safety checks passed in 0.3 s"
  - "Asking 3 vendors on WhatsApp…"
  - "Vendor 2 said no, trying next plan"
  - "All confirmed, traveler informed"

### Hero 2: Change Impact Map + 3 Fix Plans

- **Change Impact Map:** When anything changes, we show every trip item it affects, in order, with the money at risk, the time lost and the must-do items at risk.
- **3 Fix Plans:**
  - **Cheapest:** get the most money back.
  - **Fastest:** fewest changes, same day.
  - **Keep My Favourites:** protect the traveler's must-do items even if it costs a little more.
- **How the impact is found:** Every trip item knows what it depends on (the flight lands → then the airport pickup → then the hotel check-in → then the 4 pm boat ride). When the flight is 3 hours late, we follow these links forward, recalculate the times and mark each item as "moves", "at risk" or "cannot happen".
- **Why it matters:** The problem statement directly asks us to "identify the impact of such changes".
- **Demo moment:** The map fills step by step, and three plan cards appear with clear numbers: "₹1,240 refunded" / "0 extra cost, 2 swaps" / "all 3 hearts kept".

### Hero 3: All-or-Nothing Vendor Confirmation on WhatsApp

- **What it is:** A change is applied only when **every** affected vendor says yes. If even one says no, or does not reply in time, the whole change is cancelled safely and the next best plan is tried automatically.
- **Why it matters:** Today, half-updated trips are common. The hotel knows about the change, but the driver does not. This makes that impossible.
- **How it works:**
  - Each vendor gets a WhatsApp message with buttons: [Yes] [No] [Other time].
  - The system waits for all answers, with a timer (for example 10 minutes).
  - All yes means the change is saved. Any no means it is undone and tried again with other options.
  - Every change creates a **Change Receipt**: what changed, who approved it, when, and the price difference. Travelers and operators can both see it.
- **Tech name:** This follows the **saga pattern**, a known way to make multi-step changes safe (used in banking and online shopping). As far as our research found, no travel tool applies it to custom tour changes.
- **Demo moment:** A judge holds one of our "vendor" phones and taps No. The screen shows "Rolled back. Trying the next plan…", and a new vendor confirms a few seconds later.

### Hero 4: Voice Notes in Any Language (vendors and travelers)

- **What it is:**
  - Vendors can answer a request with a WhatsApp voice note, for example "Haan, 5 baje aa jaunga" ("Yes, I will come at 5"). We turn it into "Confirmed, new time 5:00 pm".
  - Travelers can send a voice note like "We are stuck in traffic" or "My father is not feeling well", and the agent helps.
- **Why it matters:** In India, many drivers and homestay owners prefer voice notes to typing or forms.
- **How it works:**
  1. WhatsApp sends us the audio file.
  2. Groq Whisper turns speech into text.
  3. Jev decides what it means: confirmed / declined / other time / needs a call, with a confidence score.
  4. If confidence is low, a human checks it.
- **Demo moment:** Play a Hindi voice note. The vendor's status turns green with the new time filled in.

### Hero 5: Jev Instant Decisions (our smart use of the new Jev model)

Jev returns fixed-type answers (yes/no, pick one, score) with a confidence number in about 0.07 to 0.5 seconds, and it cannot answer outside the options we give it. We use it in three visible ways:

- **Jev Reply Reader:** reads every vendor and traveler reply (text or voice note) and decides what it means in a fraction of a second, so the agent can act instantly and safely.
- **Jev Safety Checks:** before the agent sends anything, Jev answers meaning-based questions in parallel:
  - "The traveler wrote 'my mother has knee pain'. Does this activity need a lot of walking or stairs?"
  - "Is vegetarian food available at this lunch place?"
  - "Is this activity suitable for a 6-year-old?"

  Our own code checks the number rules at the same time: budget, time, energy and rain. On screen, a checklist of 10 checks turns green in under half a second.
- **Jev Match:** the traveler describes the trip in their own words ("quiet places, great food, my dad can't walk much"). Jev scores every activity and hotel on each wish at the same time (for example 64 activities × 4 wishes = 256 questions) in under a second, and the planner uses these scores.

**Why Jev and not only a chat model:** Jev is faster, cheaper and safer for decisions. It gives typed answers with confidence and cannot invent a new option.

**Short line for the pitch:** "Groq writes and talks. Jev decides in milliseconds."

### Hero 6: Must-Do Hearts + One-Tap Mood Buttons

- **Must-Do Hearts:** Each traveler gets only 5 hearts per trip to mark items they must not miss. Because hearts are limited, they show true priorities. Every fix plan protects hearted items first.
- **Mood Buttons:** During the trip, one tap on Tired / Hungry / Raining / Running late / Over budget / Bored (or say it) re-plans the rest of the day. For example, Tired swaps hard activities for easy ones nearby and adds a rest break.
- **Why it matters:** The problem statement asks us to respect traveler preferences during changes and to help during the journey. One tap is faster than typing to a chatbot while standing on a street.
- **Demo moment:** Tap "Tired". The day's energy bar goes from red to green, and the trek becomes a café visit and a sound-bath session nearby.

### Hero 7: What-If Simulator for Operators

- **What it is:** Operators can test a problem before it happens: "What if heavy rain hits Manali tomorrow?" or "What if this hotel closes?"
- **What they see:**
  - which tours would break
  - how many travelers are affected
  - how much money is at risk
  - whether automatic fixes can solve it

  They can send the agent to fix all affected tours in one click.
- **Why it matters:** It gives operators the full visibility and control that the problem statement asks for, so they can prepare instead of panic.
- **Demo moment:** Run "Heavy rain in Manali tomorrow". Three tours turn red, then click "Fix all with the agent".

### Hero 8: Live Alerts (early warning + crowd reports)

- **Early Warning:** For each live tour we compare the plan with reality: where the group is, the travel time on the road, flight status and weather. We warn **before** the problem happens: "Group 7 will miss the 4 pm boat by 25 minutes."
- **Crowd Reports:**
  - Any traveler, guide or vendor can report a problem at a place: road closed, ropeway shut, too crowded, place closed.
  - The report counts after a check: 2 separate reports within 2 hours, or 1 report from a trusted guide or vendor.
  - Then every other tour planning to go there gets a warning and a fix.
- **Why it matters:** In the 2025 monsoon, hundreds of roads closed without warning. An operator's own travelers become a live information network across all its tours.
- **Demo moment:** A guide taps "Ropeway closed" at Solang. Two other tours instantly get warnings with fixes.

---

## 10. Extra features (if time allows)

Build these only after all Hero features work, in this order.

| # | Feature | What it does in one line | Problem it solves |
|---|---|---|---|
| 1 | **Travel Personality Quiz ("Travel DNA")** | A fun quiz that becomes a 6-trait profile (thrill, culture, food, social, luxury, nature) with a name like "Summit Seeker" | Better personalization |
| 2 | **Energy Meter** | Each day shows an energy bar. The planner avoids three hard days in a row and has easy modes for kids and elders | Tired travelers, failed plans |
| 3 | **Backup Plans Ready in Advance ("Plan B")** | Every outdoor or low-reliability item already has a backup chosen, so switching takes one tap | Weather, no-shows |
| 4 | **Fair Group Planning** | Group members vote on activities. Everyone gets at least 2 of their top picks, and costs are split by who joins what | Money fights, group decisions |
| 5 | **Family Safety Link** | A shareable link that shows family "Safe / On time / Delayed", not the exact location | Safety and peace of mind |
| 6 | **Flex-Date Saver** | Shows the price and rain chance if you start 1 to 3 days earlier or later | Save money, avoid bad weather |
| 7 | **Team-up Price** | When enough separate travelers pick the same activity on the same day, a group discount unlocks for everyone | Operators fill seats, travelers save |
| 8 | **Vendor Trust Score** | Scores vendors on reply speed, cancellations and ratings. Low scores get a backup picked automatically | Unreliable vendors |
| 9 | **Trip Story + XP and Badges** | A shareable trip summary plus light game elements: points, badges, passport stamps | Fun, repeat users |
| 10 | **Offline Trip Pass** | The full plan, tickets and emergency numbers work without internet, with a QR code | Mountains with no network |

---

## 11. Our open-source packages (SDK) and MCP server

Tip from our senior (a previous winner): make the coolest part reusable so other developers can use it. This shows our work is bigger than one app.

| Package | What it is | Who can use it | Where we publish |
|---|---|---|---|
| **`tripfix`** | The Change Impact + Fix Plans engine. Give it a plan (items with times, places, links) and a change (delay, weather, closed vendor), and it returns what breaks and 3 fix plans. Pure logic, no AI needed. | Any travel app, event planner or logistics app | npm (TypeScript, from our existing engine code), PyPI (Python), Go module |
| **`yesflow`** | The All-or-Nothing Confirmation engine. Ask many people or vendors on WhatsApp or a web link to confirm a change, with timers, safe undo and receipts. Jev reads the replies. | Travel, weddings and events, delivery, clinics (any business that coordinates many people) | Go module + npm client |
| **Trizpyy MCP server** | Lets any AI assistant (like Claude or ChatGPT) use our tools: `get_trip`, `analyze_impact`, `make_fix_plans`, `ask_vendors`, `check_status` | AI agent builders, operators with their own AI | npm (runs locally) |

**MCP** (Model Context Protocol) is a standard way to give AI assistants tools. It is very popular in 2026 and judges like it.

**In the pitch:** "Our engine is open source. Anyone can install it with one command: `npm install tripfix`."

Note: check that the package names are free on npm and PyPI before publishing, and pick new names if they are taken.

---

## 12. How the smart parts work

This section explains the logic in simple steps. The code should follow these steps.

### 12.1 Plan builder (making the first itinerary)

1. **Inputs:** destination, start date, nights, adults, kids, budget, hotel type, transport, local transport, interests, pace (slow / balanced / packed), morning or night person, and any wishes written in the traveler's own words.
2. **Pick the hotel:** the stay that matches the chosen type (or the closest type if none), inside budget.
3. **Pick transport:** compare flight, train, bus and car by price, time and whether the route is possible.
4. **Score every activity** for this traveler, using:
   - interest match
   - Jev Match scores for their own words
   - rating
   - price compared with the budget left
   - energy level compared with their pace
   - suitability for kids
5. **Fill the days:**
   - **Day 1:** arrival, pickup, check-in, then 1 or 2 light activities.
   - **Middle days:** 2 to 4 activities based on pace, with at most one evening activity per day.
   - **Last day:** check-out, maybe one morning activity, pickup, travel home.
   - Avoid outdoor activities on rainy days (from the weather forecast).
   - Keep each day's energy under the pace limit and add rest breaks when needed.
6. **Set times:** start time + travel time between places + activity length, respecting morning, afternoon and evening windows.
7. **Output:** a full plan with times, places, costs and a map.

Groq can add friendly day titles and short descriptions, but the numbers and times always come from our code.

### 12.2 Price calculator

- **Stay** = nightly price × rooms × nights
- **Travel** = price per person × travelers × 2 (return)
- **Local transport** = daily price × vehicles × days + airport pickups
- **Activities** = ticket price × tickets (tickets can be fewer than travelers, because not everyone joins everything)
- **Group discount** if a Team-up deal unlocks
- **Total** = subtotal − promo + service fee (3%, with a cap) + tax (5%). Total ÷ travelers = price per person.
- **Budget meter:** compares the total with the traveler's budget (roomy / on budget / over budget).

### 12.3 Route and time optimizer (Python + Google OR-Tools)

- **Goals:**
  - less travel time and no back-and-forth trips
  - no clash with opening hours
  - balanced energy
  - outdoor items on dry days
- **Method:** This is a known problem called "routing with time windows", and Google's free OR-Tools library solves it. We send the places, visit lengths, opening hours and a travel-time table (from OSRM), and get back the best order and times.
- **Quick version (if short on time):** group activities by area for each day, then visit the nearest place first inside each time window. Our prototype already does this.
- **Show the result:** "Saved 1 h 40 min of travel. Moved 2 outdoor plans off the rainy day."

### 12.4 Change Impact engine

**Data:** each trip item has:
- a start and end time
- a place
- a vendor
- a cost
- a "depends on" list (for example, check-in depends on the pickup)
- a heart flag
- spare buffer minutes

**Steps:**
1. **Take the problem:** its type (delay / weather / vendor unavailable / health / closure), the day, and details (for example, how many minutes late, or which vendor).
2. **Find the first affected items:**
   - delay → the travel item
   - weather → outdoor items that day
   - vendor → all items from that vendor
   - health → high-energy items that day
   - closure → items at that place
3. **Follow the links forward:** go through the "depends on" links and the time order, and recalculate the earliest possible start for each item.
4. **Label each item:**
   - **Moves:** still fits at a new time.
   - **At risk:** fits only if everything goes well.
   - **Cannot happen:** must be changed.
5. **Add up:** money at risk, time lost, hearted items at risk and vendors touched.

### 12.5 Fix planner (the 3 plans)

For each item that is at risk or cannot happen, try these options in order and keep the ones that fit:

1. **Pre-picked backup (Plan B)** at the same time.
2. **Move to another day** that has space and good weather.
3. **Similar activity nearby** (same interests, similar price, close by).
4. **Later time** the same day (for delays).
5. **Different hotel** (cheapest / closest / best-rated) for hotel problems.
6. **Cancel with refund** (vendor's fault = full refund, otherwise the policy rate).

Then build 3 full plans with different goals (cheapest / fastest / keep favourites), and score each on cost, time and happiness (how many loved items are kept).

### 12.6 All-or-Nothing Vendor Confirmation (saga)

**States:**
- Success path: `draft → asking vendors → all said yes → saved`
- Failure path: `asking vendors → someone said no or timed out → undone → next plan`

**Steps:**
1. The agent, operator or traveler picks a plan.
2. The backend creates a confirmation record and sends each vendor a WhatsApp message with buttons (plus a web link backup).
3. Each reply is saved with the time and channel. Voice replies are turned into text, and Jev decides what they mean.
4. **All yes:**
   - apply every change at once in one database transaction
   - create the Change Receipt
   - update everyone
   - write refunds or extra charges in the money ledger
5. **Any no or timeout:**
   - send "request cancelled" to vendors who already said yes
   - mark the vendor who said no as excluded
   - build the next plan automatically
   - after 2 failed tries, alert a human coordinator with a "Call now" button
6. Everything is logged.

**Why Go is great here:** Go handles thousands of waiting replies and timers at the same time with very little memory (using goroutines). Our job queue (River, stored in Postgres) keeps timers safe even if the server restarts.

### 12.7 Trip Fixer Agent (how the agent is built)

- **Brain:** the Groq `gpt-oss-120b` model with **tool calling**, which means the model can ask our code to run specific functions.
- **Tools the agent can use:** all of them are our own Go functions with strict inputs and outputs:
  - `get_trip`
  - `analyze_impact`
  - `make_fix_plans`
  - `run_safety_checks`
  - `ask_vendors`
  - `read_replies`
  - `commit_or_undo`
  - `message_traveler`
- **The loop:** the model looks at the problem → picks a tool → our code runs it → the result goes back to the model → repeat until the problem is solved or a human is needed.
- **Limits:**
  - at most 12 steps per problem
  - a money limit per action
  - approval required for anything outside the traveler's rules
  - 2 retries at most, then a human takes over
- **Shown live:** every step (tool name, short reason, result) is saved in an `agent_steps` table and pushed to the operator screen as a timeline.
- **Backup:** if the AI limit is reached, the same steps run as a fixed playbook (rules in code), so the feature always works.

### 12.8 Early Warning

- A background job runs every few minutes for each live tour.
- It gets the group's position (from the coordinator's phone, or simulated in the demo) and asks OSRM for the travel time to the next place.
- It compares the arrival time with the start time plus buffer.
- If the group will be late by more than the buffer, it creates a "running late" problem before it happens, and the agent takes over.
- It also checks flight status (AeroDataBox) and weather for the next 24 hours (Open-Meteo).

### 12.9 Crowd report check

- A report counts when:
  - there are 2 separate reports within 2 hours, or
  - 1 report comes from a trusted guide or vendor, or
  - the place's own vendor confirms it.
- Jev checks two questions: "Is this a real problem report?" (yes/no with confidence) and "What type is it?" (closed / road blocked / crowded / unsafe / other).
- Reports expire after a set time unless someone confirms them again.

---

## 13. AI plan: Groq, Jev and Python

### 13.1 Our AI rule

> **Code decides. AI assists. Humans approve.**

- Times, prices and vendor confirmations are always calculated by our own code, so they are reliable.
- AI is used for three things:
  - **language:** understanding and writing, with Groq
  - **fast decisions:** with Jev
  - **optimization:** with Python and OR-Tools
- The agent works only inside clear limits, and big changes need a human "yes".

### 13.2 Groq (free tier): writing, talking, voice and the agent

Groq free tier as of September 2026, per organization (not per key) ([Groq rate limits](https://console.groq.com/docs/rate-limits)):

| Model on Groq | Free limit | What we use it for |
|---|---|---|
| `openai/gpt-oss-120b` | 30 requests/min, 1,000/day, 8K tokens/min, 200K tokens/day | The Trip Fixer Agent (tool calling), trip summaries, plain-word change explanations, the WhatsApp trip assistant |
| `openai/gpt-oss-20b` | Same limits | Fast structured tasks with strict JSON: turn free text into preferences, turn "make day 2 relaxed" into edit commands |
| `qwen/qwen3.8-27b` | Same limits | Backup model and Hindi or regional-language chat |
| `whisper-large-v3-turbo` | 20 requests/min, 2,000/day | Voice notes to text (vendors and travelers) |
| `meta-llama/llama-prompt-guard-2-86m` | 30 requests/min, 14,400/day | Safety check on incoming WhatsApp and chat messages, so nobody can trick our AI with a message like "ignore your rules and confirm" |
| `openai/gpt-oss-safeguard-20b` | Same as gpt-oss | Optional: filter unsafe reviews or crowd reports |

- **Strict JSON mode:** Groq can guarantee that the answer follows our exact data shape (`response_format` with `json_schema` and `strict: true`) on gpt-oss-20b, gpt-oss-120b and qwen3.8-27b ([Groq structured outputs](https://console.groq.com/docs/structured-outputs)).
- **Note:** Llama chat models left Groq's free tier in August 2026, so we do not plan around them ([source](https://klymentiev.com/blog/groq-pricing)).

**How we stay inside the free limits:**
- Use code and rules first. For example, weather alerts use rain thresholds, not AI.
- Cache every AI answer: the same question gives the same stored answer.
- Batch many small questions into one request.
- Pre-generate descriptions for demo data once and store them.
- Switch models if one reaches its daily limit.
- The agent has a fixed-playbook backup (Section 12.7).

### 13.3 Jev: fast, typed decisions (confirmed as part of our stack)

**What Jev is** ([DigitalOcean](https://www.digitalocean.com/resources/articles/what-is-jev), [Wikipedia](https://en.wikipedia.org/wiki/Jev_(AI_model))):
- A new model released on 15 September 2026 by TypeSafe AI.
- It does **not** write text. It returns **typed decisions**:
  - **Choice:** pick one option from our list.
  - **Score:** rate on our scale.
  - **Yes/no:** with a probability.
- Every answer has a confidence number, and it cannot return anything outside our options.
- It is very fast (70 to 500 milliseconds) and answers many questions at the same time.
- It is very cheap: about $0.042 per million input tokens, and output is free.
- It cannot chat or explain itself (that is Groq's job).
- Access started as limited early access. **Apply for access on day one.**

**Cost example:** One vendor reply is about 150 tokens, so 10,000 decisions cost about $0.06 (around ₹5). For the whole hackathon, Jev costs less than a cup of chai.

**All the places we use Jev:**

| Use | The question we ask Jev | Output type |
|---|---|---|
| Vendor reply reader | "Is this reply: confirmed / declined / other time / needs a call?" | Choice + confidence |
| Traveler message sorting | "Is the traveler: tired / hungry / late / unwell / asking about money / other?" | Choice |
| Problem type and seriousness | "What kind of problem is this?" and "How serious for the trip, 1 to 5?" | Choice + Score |
| Safety checks before the agent acts | "Does this activity need a lot of walking?" "Is vegetarian food available?" "Is it OK for a 6-year-old?" | Yes/no (in parallel) |
| Jev Match (personalization) | "How well does this activity fit this wish, 1 to 5?" for every activity and every wish | Score (in parallel) |
| Crowd report check | "Is this a real problem report?" "What type?" | Yes/no + Choice |
| Review scoring | "Sentiment 1 to 5? Mentions safety? Mentions cleanliness?" | Score + Yes/no |

**Design choice for safety:** In Go we build a small **Decision Service** with one function: `Decide(question, options) → answer + confidence`. Jev is the main engine. Groq `gpt-oss-20b` with strict JSON is the automatic backup if Jev is slow or down, so the demo always works.

### 13.4 Python AI service (free, open-source)

| Part | Library | What it does |
|---|---|---|
| Route and time optimizer | Google OR-Tools | Best order and times for each day (routing with time windows) |
| Similar-item search | sentence-transformers (small model like `all-MiniLM-L6-v2`) + pgvector | Finds activities similar to what the traveler likes. Powers search by feeling. |
| Delay risk | scikit-learn (simple logistic regression) trained on demo history | "This transfer has a 32% chance of running late". Helps Early Warning. |
| Vendor trust score | scikit-learn or simple formulas | Reliability from reply speed, refusals, cancellations and ratings |

Python runs as a small FastAPI service, and Go calls it over HTTP.

### 13.5 Other language options

- **Bhashini** (Government of India): free speech-to-text, text-to-speech and translation for 22 Indian languages ([Bhashini](https://schemesinindia.in/central/bhashini-digital-india-language-ai-platform)). Useful for regional-language vendors.
- **Browser speech (Web Speech API):** free text-to-speech that reads updates aloud in the traveler app.

---

## 14. WhatsApp plan: how we use it (almost free)

We use the **official WhatsApp Business Platform (Cloud API) by Meta**. Everyone in India already uses WhatsApp, so vendors and travelers do not need a new app.

### 14.1 What is free and what costs money

- **Free for our demo:** Meta gives every developer a free test phone number. It can send messages to up to 5 verified phone numbers. We add our teammates' phones (and one extra for a judge to hold). ([Meta docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/), [Wati](https://www.wati.io/en/blog/test-whatsapp-message-sends-safely/))
- **Free in real use:** when a vendor or traveler messages us first, a 24-hour "customer service window" opens. Inside this window, all our normal replies are free: text, buttons, lists, images and audio. ([Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing))
- **Cheap outside the window:** we must use an approved "utility" template message. In India this costs about ₹0.115 per message (July 2026 rate card) plus 18% GST. 100 vendor requests cost about ₹14. ([WhAutomate](https://whautomate.com/whatsapp-business-api-pricing-india))
- **Marketing messages** always cost more, and we do not need them.

### 14.2 What we send and receive

| Message | Who gets it | Format |
|---|---|---|
| Booking request | Vendor | Utility template with buttons [Confirm] [Can't do] [Other time] |
| Change request | Vendor | Utility template with buttons [Yes] [No] [Other time] |
| Request cancelled | Vendor | Free text inside the window, or a utility template |
| Trip update ("Your plan changed…") | Traveler | Free text inside the window, or a utility template |
| Help messages and voice notes | From traveler or vendor | Arrive at our webhook. We reply for free inside the window. |

### 14.3 Voice notes

1. WhatsApp sends our webhook a message with a media ID.
2. We download the audio from the Graph API.
3. Groq Whisper turns it into text.
4. Llama Prompt Guard checks that it is safe.
5. Jev decides what it means.
6. The agent acts on it.

### 14.4 Following WhatsApp's 2026 AI rules

Since January 2026, WhatsApp does not allow general-purpose AI chatbots (like a ChatGPT clone) on its business platform. It **does** allow AI assistants with a clear business purpose, such as bookings, trip updates and customer support. Our assistant only helps with trips and bookings, so it follows the rules. ([respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban), [Turn.io](https://learn.turn.io/l/en/article/khmn56xu3a-whats-app-s-2026-ai-policy-explained))

### 14.5 Setup steps (do these on day one)

1. Create a Meta developer account and a new app, then add the WhatsApp product.
2. Copy the test phone number ID and the access token.
3. Add up to 5 recipient phone numbers and verify each with the code WhatsApp sends.
4. Create message templates (`booking_request`, `change_request`, `trip_update`) in the "utility" category with quick-reply buttons, and submit them for approval early (approval can take some time).
5. Set the webhook URL (our Go backend on Render, or a free Cloudflare Tunnel to a laptop) and the verify token.
6. Subscribe to `messages` events so we receive replies, button taps and voice notes.

### 14.6 Backup

- Every WhatsApp message also has a short web link (`/v/{token}`) where the vendor can answer on a simple page with no login.
- Operators see all messages in one inbox inside the console.

---

## 15. Final tech stack

| Layer | Choice | Why | Cost |
|---|---|---|---|
| Frontend | **Next.js** (latest, App Router) + **TypeScript** | Our team's choice. Server pages load fast, client pages power the interactive planner. | Free |
| Styling | **Tailwind CSS v4** + our own design tokens (clay colors, shadows, corner radius) | Our team's choice. Fast to build a consistent look. | Free |
| UI building blocks | **Radix UI** (unstyled, accessible) styled by us | Accessible menus, dialogs and tabs without the common "template look" | Free |
| Animation | **Motion** (Framer Motion) | Smooth, springy, playful animations | Free |
| Icons | **Phosphor Icons** | Friendly rounded icons | Free |
| Maps | **MapLibre GL JS** + **OpenFreeMap** tiles | Beautiful maps with no API key and no bill ([OpenFreeMap](https://openfreemap.org/)) | Free |
| Data fetching | **TanStack Query** | Caching and live refresh | Free |
| UI state | **Zustand** | Simple state for the planner | Free |
| Offline | **Serwist** (PWA) | Offline Trip Pass, install on phone | Free |
| Charts | **Recharts** | Operator charts | Free |
| Backend | **Go** (1.25+) with the **chi** router | Our team's choice. Fast, simple, great at many waiting tasks. | Free |
| Database access | **pgx** + **sqlc** (type-safe SQL) + **goose** (migrations) | Clean and fast | Free |
| Background jobs | **River** (Go job queue stored in Postgres) | Confirmation timers, weather and flight checks, reminders. No Redis needed. | Free |
| Real-time | **WebSockets** in Go (`coder/websocket`) | Instant updates on every screen | Free |
| Database | **PostgreSQL** on **Neon** free tier (3 GiB per branch) + **pgvector** | One database for everything, including AI search ([Koyeb list](https://www.koyeb.com/blog/top-postgresql-database-free-tiers-in-2026)) | Free |
| AI service | **Python + FastAPI + OR-Tools + scikit-learn + sentence-transformers** | Optimization and small ML models | Free |
| LLM, agent, voice | **Groq** free tier (gpt-oss-120b, gpt-oss-20b, qwen3.8-27b, Whisper, Prompt Guard) | Writing, chat, tool calling, voice | Free |
| Fast decisions | **Jev** (main) + Groq gpt-oss-20b (backup) | Typed decisions in milliseconds | A few rupees |
| Messaging | **WhatsApp Business Platform (Cloud API)** | Everyone uses it. Buttons and voice notes. Free test number, free replies inside 24 hours. | Free for the demo |
| Agent tools standard | **MCP server** (official Go or TypeScript MCP SDK) | Other AI assistants can use our tools | Free |
| Email | **Resend** free tier (optional) | Booking confirmation emails | Free |
| Payments | **Razorpay Test Mode** | Real checkout flow with test UPI and cards | Free |
| Weather | **Open-Meteo** | No key needed. Under 10,000 calls per day for non-commercial use, with attribution ([Open-Meteo](https://open-meteo.com/en/pricing)). | Free |
| Routing | **OSRM** (free public server) | Travel times and routes | Free |
| Addresses | **Nominatim** (max 1 request per second) | Place search | Free |
| Places | **OpenTripMap** / **Overpass API** | Attractions and points of interest | Free |
| Flights | **AeroDataBox** free (600 units per month) or **OpenSky**, plus our live event simulator ([flight API list](https://thunderbit.com/blog/best-flight-api-with-free-tiers)) | Flight delay signals | Free |
| Hosting (web) | **Vercel** Hobby | Best home for Next.js | Free |
| Hosting (Go + Python) | **Render** free web service, or **Google Cloud Run** free tier (2 million requests per month) ([free hosting list](https://snapdeploy.dev/blog/free-backend-hosting-2026-apis-servers)) | Runs our containers | Free |
| Public URL for webhooks | **Cloudflare Tunnel** (free) | Lets WhatsApp reach a laptop during development | Free |
| Local development | **Docker Compose** | One command starts everything | Free |
| Code and testing | **GitHub** + **GitHub Actions** | Tests and builds | Free |

**Total running cost for the hackathon: about ₹0 to ₹50** (only Jev tokens and a few WhatsApp template messages, if used outside the free test setup).

---

## 16. System architecture

### 16.1 Big picture

```
   Traveler app            Operator console             WhatsApp
   (Next.js, PWA)          (Next.js dashboard)          (vendors + travelers)
          \                        |                           /
           \____ HTTPS (REST) + WebSocket ____      ___ Meta Cloud API webhook
                                          \    /
                     +------------------------------------+
                     |          Go Core API (chi)          |
                     |  auth, catalog, trips, pricing,     |
                     |  booking, ops, impact, fixes,       |
                     |  confirmation (saga), agent,        |
                     |  decider, alerts, realtime, notify  |
                     +------------------------------------+
                      |         |            |          |
             PostgreSQL     Python AI     Groq        Jev
             (Neon)         service       (agent,     (fast typed
             + pgvector     (FastAPI:     writing,    decisions)
             + River jobs    OR-Tools,    Whisper)
                             ML, search)
                                   |
   Free data services: Open-Meteo (weather), OSRM (routes), OpenFreeMap (map tiles),
   Nominatim (addresses), OpenTripMap/Overpass (places), AeroDataBox (flights),
   Razorpay Test Mode (payments)

   MCP server (separate small service): lets outside AI assistants call our tools
```

### 16.2 Go backend modules (one Go service keeps it simple)

| Module | Job |
|---|---|
| `auth` | Login, roles (traveler, operator admin, coordinator, vendor), JWT tokens |
| `catalog` | Destinations, places, activities, stays, transport options, vendors, prices |
| `profile` | Quiz answers, Travel DNA, wishes in the traveler's own words |
| `planner` | Build a plan from preferences (calls the Python optimizer and Jev Match) |
| `pricing` | Price breakdown, promos, budget status |
| `trips` | Trip items: swap, add, move, remove, hearts, quantities |
| `booking` | Bookings per vendor and item, statuses |
| `payments` | Razorpay test orders, webhook, money ledger (payments, payouts, refunds) |
| `ops` | Tours list, groups, coordinators, schedules, overview numbers |
| `incidents` | Create problems from any source (weather job, flight job, WhatsApp, operator, crowd) |
| `impact` | Change Impact engine (Section 12.4), shared with the `tripfix` package |
| `fixes` | 3 fix plans (Section 12.5) |
| `confirm` | All-or-Nothing Vendor Confirmation (Section 12.6), shared with the `yesflow` package |
| `agent` | Trip Fixer Agent loop and tools (Section 12.7) |
| `decider` | Decision Service: Jev main, Groq backup |
| `ai` | Groq client: chat, JSON, tool calling, Whisper, Prompt Guard |
| `whatsapp` | Send templates and messages, receive webhooks, download voice notes |
| `alerts` | Early Warning and crowd reports (Sections 12.8 and 12.9) |
| `realtime` | WebSocket rooms per trip and per operator |
| `jobs` | River jobs: timers, weather and flight checks, reminders |
| `notify` | In-app notices, WhatsApp messages, emails |

### 16.3 Example flow: booking a trip

1. The traveler clicks **Book**, and Next.js calls `POST /trips/{id}/book`.
2. Go creates a Razorpay test order, and the traveler pays with a test UPI or card.
3. Razorpay calls our webhook. Go marks the trip as paid, writes the ledger and creates one booking per vendor.
4. Go sends each vendor a WhatsApp `booking_request` with buttons, and each vendor taps **Confirm**.
5. Each confirmation updates the booking status, and a WebSocket pushes it to the traveler and operator screens instantly.

### 16.4 Example flow: heavy rain during a trip (the agent)

1. A River job checks Open-Meteo every 30 minutes for all upcoming tour days.
2. Rain above our limit on a day with outdoor items creates a weather problem.
3. The agent starts:
   - impact → 3 fix plans → safety checks (Jev + code)
   - picks "Keep My Favourites" (it is inside the traveler's rules)
   - sends WhatsApp change requests
4. One vendor taps **No**. The agent undoes the change and tries the next plan. A new vendor replies with a voice note: "Haan, kal subah 9 baje". Whisper and Jev read it as "confirmed, 9 am".
5. All vendors confirmed → the change is saved, the Change Receipt is written and refunds go into the ledger.
6. The traveler gets a WhatsApp message and an in-app card: "Rain tomorrow. We moved your kayaking to Thursday (sunny) and swapped the fort walk for the museum. You save ₹640."

### 16.5 Example flow: a traveler sends a voice note

1. The traveler sends "We are stuck in traffic, we will be late" on WhatsApp.
2. Whisper turns it into text, Prompt Guard checks it and Jev sorts it as "late, seriousness 3".
3. The agent checks the next item (a 4 pm boat ride), asks the boat vendor to move it to 4:45 pm, and gets a yes.
4. The traveler gets: "No problem! Your boat ride is now at 4:45 pm."

### 16.6 Real-time events (sent over WebSocket)

`trip.updated`, `booking.status`, `incident.created`, `impact.ready`, `fixplans.ready`, `agent.step`, `confirm.progress`, `confirm.saved`, `confirm.undone`, `alert.verified`, `warning.early`, `notice.new`

---

## 17. Folder structure

```
trizpyy/
  apps/
    web/                       Next.js (traveler app + operator console + vendor reply page)
      app/
        (traveler)/            home, discover, destination/[id], quiz, plan, cart, booked,
                               trip, live, adapt, review, profile
        (operator)/ops/        overview, tours, tours/[id], bookings, vendors, incidents,
                               agent, simulate, alerts, team, payments, inbox
        v/[token]/             vendor one-page reply (no login)
      components/              ui (buttons, chips, cards), art (clay icons, mascot), map, charts
      lib/                     api client, websocket client, formatters
      styles/                  Tailwind theme tokens
  services/
    api/                       Go
      cmd/api/main.go
      internal/                auth, catalog, profile, planner, pricing, trips, booking,
                               payments, ops, incidents, impact, fixes, confirm, agent,
                               decider, ai, whatsapp, alerts, realtime, jobs, notify, store
      db/migrations/           goose SQL migrations
      db/queries/              sqlc queries
    ai/                        Python FastAPI
      app/main.py
      optimizer/               OR-Tools
      search/                  embeddings + pgvector
      risk/                    delay risk + vendor trust models
    mcp/                       MCP server (our tools for outside AI assistants)
  packages/
    tripfix/                   open-source impact + fix engine (npm + PyPI + Go)
    yesflow/                   open-source all-or-nothing confirmation (Go + npm client)
    contracts/                 OpenAPI spec, generates TypeScript types
  seed/                        demo data: destinations, places, vendors, tours, history
  infra/
    docker-compose.yml         postgres, api, ai, web
  allaboutourproject.md        this file
```

---

## 18. Database design

Main tables in simple words (PostgreSQL).

| Table | Main columns | Meaning |
|---|---|---|
| `users` | id, name, email, phone, whatsapp_number, role | Everyone who logs in |
| `operators` | id, name, settings | The travel company |
| `traveler_profiles` | user_id, dna (json), interests, pace, rhythm, own_words, rules (auto-approve limit) | Quiz results and wishes |
| `destinations` | id, name, region, lat, lng, best_months, rainy_months | Places people travel to |
| `places` | id, destination_id, name, lat, lng, open_hours, type | Points on the map |
| `vendors` | id, operator_id, name, kind (stay/activity/transport/local), whatsapp_number, trust_score, available | Hotels, drivers, activity partners |
| `activities` | id, vendor_id, place_id, title, description, interests, duration_min, price, energy, outdoor, slot, backup_activity_id | Things to do |
| `stays` | id, vendor_id, place_id, name, type, nightly_price, rating | Hotels and homestays |
| `transport_options` | id, vendor_id, mode, origin, destination, price, duration_min | Flights, trains, buses, cars |
| `trips` | id, operator_id, customer_id, destination_id, start_date, nights, adults, kids, budget, status, payment_status, coordinator_id, group_name | One custom trip |
| `trip_members` | trip_id, user_id, role, hearts_left | Group members |
| `trip_items` | id, trip_id, day, kind, ref_id, vendor_id, place_id, start_at, end_at, cost, qty, hearted, status, depends_on (list of ids), buffer_min, backup_ref_id, note | Each step of the plan |
| `bookings` | id, trip_item_id, vendor_id, status (requested/confirmed/declined/cancelled), confirmed_at | One booking per vendor per item |
| `payments` | id, trip_id, provider, provider_ref, amount, status | Customer payments |
| `ledger_entries` | id, trip_id, kind (payment/payout/refund/adjustment), party, amount, status | All money movements |
| `incidents` | id, trip_id, kind, day, severity, source, status, details (json), excluded_vendors | Problems |
| `impact_items` | incident_id, trip_item_id, level (moves/at-risk/cannot-happen), reason, cost_at_risk | Change Impact result |
| `fix_plans` | id, incident_id, strategy (cheapest/fastest/favourites), cost_change, scores (json) | The 3 plans |
| `fix_actions` | plan_id, type (swap/move/shift/rebook/cancel), trip_item_id, to_ref_id, to_day, cost_change, note | Steps inside a plan |
| `confirmations` | id, incident_id, plan_id, attempt, phase, deadline_at | One all-or-nothing round |
| `confirmation_votes` | confirmation_id, vendor_id, answer, channel (button/voice/web), raw_text, confidence, answered_at | Each vendor's answer |
| `agent_runs` | id, incident_id, status, started_at, finished_at | One agent job |
| `agent_steps` | run_id, step_no, tool, reason, input (json), output (json), took_ms | Each step shown on the live timeline |
| `decisions` | id, engine (jev/groq), question, options, answer, confidence, took_ms | Log of every fast decision |
| `wa_messages` | id, direction (in/out), phone, type (text/button/audio/template), body, media_id, status, window_open_until | WhatsApp inbox and window tracking |
| `change_receipts` | id, trip_id, title, details (json), approved_by, cost_change, created_at | Clear record of every change |
| `crowd_reports` | id, place_id, reporter_id, type, text, created_at, verified, expires_at | Live crowd alerts |
| `reviews` | id, trip_id, stars, aspects (json), text | Ratings |
| `notices` | id, user_id, title, body, link, read | In-app notifications |
| `xp_events` | user_id, points, reason | Game points and badges |
| `embeddings` | ref_type, ref_id, vector (pgvector) | For similar-item search and search by feeling |

---

## 19. API design

REST over HTTPS, with JSON in and out. All operator routes need the operator role.

**Traveler**

| Method | Path | What it does |
|---|---|---|
| POST | `/auth/login` | Log in (demo accounts are fine) |
| GET | `/destinations`, `/destinations/{id}` | Browse destinations |
| GET | `/activities?destination=&interests=` | Browse experiences |
| POST | `/profile/quiz` | Save the quiz, get Travel DNA |
| POST | `/trips` | Create a draft plan from preferences and own words |
| GET | `/trips/{id}` | Full plan with times and prices |
| POST | `/trips/{id}/items` | Add an item |
| PATCH | `/trips/{id}/items/{itemId}` | Swap, move, remove, heart, change quantity |
| GET | `/trips/{id}/alternatives?item=` | Compare options for an item |
| POST | `/trips/{id}/optimize` | Run the optimizer, returns the new plan and time saved |
| GET | `/trips/{id}/price` | Price breakdown |
| POST | `/trips/{id}/promo` | Apply a promo code |
| POST | `/trips/{id}/book` | Start payment (Razorpay test) |
| POST | `/trips/{id}/mood` | Mood button (tired, hungry, raining, late, over budget, bored) |
| POST | `/trips/{id}/voice` | Voice message from the app, returns what we understood |
| POST | `/trips/{id}/reports` | Crowd report at a place |
| GET | `/trips/{id}/receipts` | Change Receipts |
| POST | `/trips/{id}/review` | Submit a review |
| GET | `/share/{token}` | Family Safety Link (public, limited information) |

**Operator**

| Method | Path | What it does |
|---|---|---|
| GET | `/ops/overview` | Main numbers and live tours |
| GET | `/ops/tours`, `/ops/tours/{id}` | Tours list and details |
| GET | `/ops/bookings` | All bookings with filters |
| GET/POST/PATCH | `/ops/vendors` | Manage vendors |
| PATCH | `/ops/vendors/{id}/availability` | Pause a vendor (creates problems for affected trips) |
| GET | `/ops/incidents` | Problems list |
| GET | `/ops/incidents/{id}/impact` | Change Impact Map data |
| GET | `/ops/incidents/{id}/plans` | The 3 fix plans |
| POST | `/ops/incidents/{id}/apply` | Start the all-or-nothing confirmation for a plan |
| POST | `/ops/incidents/{id}/agent` | Let the agent handle it |
| GET | `/ops/agent/runs/{id}` | Agent steps (also pushed live) |
| POST | `/ops/simulate` | What-If Simulator (does not touch real data unless applied) |
| GET | `/ops/inbox` | All WhatsApp conversations |
| GET | `/ops/coordinators`, PATCH `/ops/tours/{id}/coordinator` | Guides and assignment |
| GET | `/ops/ledger` | Money in and out |

**Vendor and system**

| Method | Path | What it does |
|---|---|---|
| GET | `/whatsapp/webhook` | Meta webhook verification |
| POST | `/whatsapp/webhook` | Incoming WhatsApp messages, button taps and voice notes |
| GET | `/v/{token}` | Vendor one-page request (no login) |
| POST | `/v/{token}/reply` | Vendor answer from the web page |
| POST | `/payments/webhook` | Razorpay webhook |
| GET | `/ws` | WebSocket for live events |

---

## 20. Outside services and their limits

| Service | Used for | Limit (Sept 2026) | Our safety plan |
|---|---|---|---|
| Groq | Agent, writing, JSON, voice | 1,000 requests per day per chat model, 2,000 voice requests per day, shared by the whole organization | Cache, batch, rules first, switch models, playbook backup |
| Jev | Fast decisions | Paid, very cheap (about $0.042 per million input tokens) | Groq backup behind the same Decision Service |
| WhatsApp Cloud API | Vendor and traveler messages | Free test number (5 recipients). Free replies inside the 24-hour window. Utility template about ₹0.115 each. | Web-link backup, templates approved early |
| Open-Meteo | Weather | Under 10,000 calls per day, non-commercial, attribution | Cache per destination per hour |
| OSRM public server | Routes and travel times | Fair use | Cache travel-time tables per destination |
| OpenFreeMap | Map tiles | Free, no key | Nothing needed |
| Nominatim | Addresses | 1 request per second | Cache and pre-load demo places |
| AeroDataBox | Flight status | 600 units per month | Use for demo flights only, plus our event simulator |
| Razorpay | Payments | Test mode is free | Test mode only |
| Neon | Postgres | 3 GiB per branch | Plenty for a hackathon |
| Vercel / Render / Cloud Run | Hosting | Free tiers (Render sleeps when idle) | Wake servers 10 minutes before the demo, keep a local copy running |

---

## 21. All screens

### 21.1 Traveler app

1. **Welcome:** big friendly heading, illustration, "Start planning" button.
2. **Taste quiz:** name, feelings, "describe your trip in your own words", from-city, destination matches, dates with the flex-date saver, people, budget meter, hotel type, transport, pace. Ends with the Travel DNA reveal.
3. **Home / Discover:** greeting, deals banner, recommendation chips, destination cards, trending list.
4. **Destination details:** about, best months, top experiences, stays, match score, "Plan this trip".
5. **Trip builder:** day cards with a timeline, hearts, swap and compare, energy bars, map tab, "Optimize" button, live price panel.
6. **Compare sheet:** the current item next to its alternatives (price, time, distance, rating, rain safety).
7. **Your order (cart):** each part of the trip as a colored row with quantity buttons, promo code, subtotal, total, "Book now".
8. **Payment success:** big check mark, payment details, next steps.
9. **My trip:** 11-step progress bar, countdown, prep checklist, Change Receipts, Offline Trip Pass, "Connect WhatsApp" button.
10. **Live trip:** map with route and moving marker, guide card with call and chat, arrival time, mood buttons, alerts.
11. **Fix screen:** Change Impact Map, 3 fix plans, safety checks, vendor confirmation progress, result.
12. **Thank you / Review:** stars, simple ratings for stay, guide and experiences, trip story.
13. **Profile:** Travel DNA chart, level and points, badges, passport stamps, saved places, auto-approve limit setting.

### 21.2 Operator console

1. **Overview:** key numbers (live tours, departures this week, revenue, open problems, vendor reply rate), live tour timeline, problems feed, today's schedule.
2. **Tours:** list with status and risk, filters.
3. **Tour details:** plan, travelers, coordinator, vendors, payments, Change Receipts, traveler's view.
4. **Bookings:** table with status filters.
5. **Vendors:** cards with trust score, capacity, contact, WhatsApp status and an "Available" switch.
6. **Problems center:** list + Change Impact Map + 3 plans + confirmation progress per vendor + retry history.
7. **Agent live view:** the step-by-step timeline of the Trip Fixer Agent, with a "take over" button.
8. **What-If Simulator:** choose a scenario and see affected tours, money at risk, "Fix all with the agent".
9. **Inbox:** all WhatsApp conversations, with voice notes shown as text and Jev's decision.
10. **Crowd alerts:** map of verified and pending reports.
11. **Team and groups:** coordinators, workload, tour assignment, group members.
12. **Payments:** ledger (payments, payouts, refunds), simple charts.

### 21.3 Vendor (on WhatsApp)

1. **Request card:** clear details + [Yes] [No] [Other time] buttons, or a voice-note reply.
2. **Daily schedule message:** today's pickups and bookings.
3. **One-page web link:** the same request for anyone who prefers the browser.

---

## 22. UI and UX design: which style wins and why

"Have a good UI" was tip number 1 from our senior. Hackathon guides also say a polished UI strongly affects how judges score innovation, and that the main idea must be clear within 30 seconds ([AngelHack](https://angelhack.com/blog/hackathon-tips-for-winners/), [Masai](https://www.masaischool.com/blog/how-to-win-an-ai-hackathon-in-2026-full-guide/)).

### 22.1 Style options compared

| Style | Looks like | Good for | Problems for us |
|---|---|---|---|
| **Brutalism** | Raw, harsh, thick borders, plain boxes | Art and portfolio sites | Feels cold. Hard to read in dashboards. Very common in hackathons lately. |
| **Neo / soft brutalism** | Bold black outlines, flat bright blocks, hard shadows | Bold startup brands | Trendy and common now. Can feel loud for families planning a holiday. |
| **Glassmorphism** | Frosted see-through panels | Futuristic tech | Low contrast, looks generic, can be slow |
| **Claymorphism** | Soft, rounded, puffy shapes with pastel colors | Friendly consumer apps, travel, learning | Can look too cute for dashboards, and low contrast if done carelessly |
| **Clean minimal** | White space, thin lines | Serious tools | Safe but forgettable. Looks like every template. |
| **Bento grid** | A dashboard made of rounded boxes of different sizes | Dashboards and overviews | Needs careful spacing |

Design writers in 2026 describe claymorphism as the soft, warm, friendly choice and neo-brutalism as the bold, loud choice. What matters most is that the product works and stays readable ([Setproduct](https://www.setproduct.com/blog/retro-brutalist-ui-design-2026), [Brandemic](https://brandemic.in/blog/must-know-ui-design-trends)).

### 22.2 Our choice: "Soft Clay" for travelers + "Calm Bento" for operators

- **Traveler app = Soft Clay:**
  - pastel colors, big rounded cards and soft 3D-style icons
  - a friendly mascot ("Zippy", a happy suitcase)
  - springy animations and light game elements
  - Travel is emotional and fun, and this style matches our reference design.
- **Operator console = Calm Bento:**
  - the same colors and fonts, but flatter cards with less shadow
  - more white space, big clear numbers, tidy tables and strong status colors
  - Operators need to read fast.
- **Why not neo-brutalism:** it is the most common hackathon look right now, so many projects will look alike. Soft clay done well stands out, and our real users (families, couples, small businesses) find it friendly.
- **Result:** one brand, playful where feelings matter and clear where work matters.

### 22.3 Design system

**Colors (from our reference design)**

| Name | Hex | Use |
|---|---|---|
| Canvas | `#E4EAF3` | Page background on desktop |
| Ink | `#1C1B2B` | Main text |
| Muted | `#9794AB` | Secondary text |
| Black pill | `#1C1B22` | Main buttons |
| Pink | `#F9CBC9` / `#FDE4E2` | Welcome screen, stays |
| Coral | `#F08A6C` | Highlights |
| Lavender | `#C6B5F6` / `#ECE5FE` | Banners, cards |
| Purple | `#7B5CF0` | Active states, routes, check marks |
| Mint | `#D0E8BA` / `#E3F1D4` | Nature, success |
| Cream / Sun | `#FDEEDC` / `#FAD47F` | Food, trending, warnings |
| Sky | `#C4DEF8` / `#DFEEFC` | Mountains, water, information |
| Star yellow | `#FFC23D` | Ratings |

**Fonts:** Unbounded (bold, wide headings, like the reference) + Poppins (body text). Both are free Google Fonts.

**Shapes:** corner radius from 16px (small) to 40px (big cards), pill-shaped buttons, round icon buttons.

**Clay shadow recipe:** one soft outer shadow + one light inner shadow at the top + one soft inner shadow at the bottom. Example: `0 18px 34px -16px rgba(62,44,130,.26), inset 0 -6px 12px rgba(40,22,96,.07), inset 0 6px 12px rgba(255,255,255,.9)`.

**Motion:**
- spring animations of 200 to 350 ms
- cards lift slightly on hover
- buttons shrink slightly when pressed
- confetti only for big moments
- respect the "reduce motion" setting

**Signature patterns:**
- black pill buttons
- staggered two-column destination cards
- colored order rows with round quantity buttons
- 3D objects overlapping the edge of their card
- energy battery and hearts
- purple route line on a soft map
- ticket-style payment receipt
- the agent's live step timeline
- the green safety checklist

### 22.4 Accessibility and quality rules

- Text contrast at least WCAG AA: dark text on pastel, never grey text on pastel for important information.
- Buttons and touch targets at least 44 × 44 px, with visible focus rings for keyboard users.
- Phone first, then tablet and desktop.
- Every status uses color **and** text or an icon, not color alone.
- Supports "reduce motion" and many languages.

### 22.5 "Does not look AI-made" checklist

- [ ] No purple-to-blue gradient hero, no default template cards, no single generic font everywhere.
- [ ] Our own illustrations and mascot, not stock images.
- [ ] Real Indian places, real prices in ₹, believable vendor names.
- [ ] Short, human text ("Your plan just fixed itself") instead of robotic text.
- [ ] Every button has a pressed state, every list has an empty state and every wait has a friendly loading state.

---

## 23. Demo script for the judges (7 minutes)

**Setup before the demo:**
- Demo data loaded.
- 3 teammates' phones connected to our WhatsApp test number as "vendors", plus 1 extra phone that a judge can hold.
- Operator console on the big screen, traveler app mirrored from a phone.
- Jev and Groq keys tested. The event simulator is ready.

| Time | What we show | What we say (simple) |
|---|---|---|
| 0:00 | One slide: 842 roads closed in Himachal in 2025, 1 in 7 flights delayed in India | "Custom trips break all the time, and operators fix them over WhatsApp for hours." |
| 0:25 | The traveler types: "3 days in Manali, quiet places, great food, my dad can't walk much." Jev Match scores 256 items in under a second, and the plan appears with a map and live price. | "The traveler describes the trip in their own words. Jev scores every option in milliseconds." |
| 1:15 | Heart 2 items, tap Optimize, book with Razorpay test, confetti | "Hearts mark must-dos. The optimizer saved 1 hour 40 minutes of travel. Booked." |
| 1:50 | The booking appears live in the operator console. Vendors get WhatsApp requests and tap Confirm. | "Every vendor confirms on WhatsApp in one tap. No new app, no login." |
| 2:30 | What-If Simulator: "Heavy rain in Manali tomorrow". 3 tours turn red, money at risk shown. | "Operators see problems before they happen." |
| 3:00 | Click "Let the agent fix it". The agent timeline plays: impact map → 3 plans → 10 safety checks go green in 0.3 s → WhatsApp requests sent | "This is our Trip Fixer Agent. Watch it work." |
| 3:40 | The judge's phone buzzes and they tap **No**. The agent says "Vendor declined, trying next plan". Another vendor replies with a Hindi voice note, which becomes "Confirmed, 9 am". Saved. | "A change happens only when every vendor says yes. Nothing is ever half-updated. And vendors can just talk." |
| 4:40 | The traveler's phone gets a WhatsApp message in plain words + refund + Change Receipt | "The traveler knows exactly what changed and why." |
| 5:10 | The traveler sends a voice note: "We're stuck in traffic." The agent moves the boat ride to 4:45 pm by itself (inside the traveler's rules). | "Help is one voice note away." |
| 5:45 | A guide taps "Ropeway closed". Two other tours get warnings. | "Our travelers become a live alert network across all tours." |
| 6:10 | Slide: `npm install tripfix` + our MCP server | "Our engine is open source. Any travel app or AI assistant can use it." |
| 6:40 | Close with the operator numbers (time saved, problems fixed) | "From 3 hours of calls to 3 minutes. Trizpyy: plan your own trip, we handle the changes." |

**Backup plan:** a "Demo mode" button runs the same story with simulated vendors and saved weather data, in case the internet fails. It uses the same live pipeline, just with events sent from our simulator.

---

## 24. Pitch rules and judge questions

### 24.1 Tips from our senior (previous winner of this college's hackathon)

1. **Have a great UI.**
2. **Have a solid USP** that makes judges say "Wow!" (ours: a broken trip fixes itself, with every vendor's yes on WhatsApp).
3. **Make the cool part reusable** as an npm or PyPI package or SDK (ours: `tripfix`, `yesflow` and the MCP server).
4. **Add agentic AI** that feels like magic (ours: the Trip Fixer Agent).
5. **Use Jev in a smart way** (ours: Reply Reader, Safety Checks and Jev Match).
6. **Be confident. Never use negative sentences.** Answer every question in a positive way.

### 24.2 How we talk during the pitch

**Phrases we use:**
- "Great question! We handle that with…"
- "That's a wonderful way to look at it. We built [feature], which does something very similar."
- "Yes, and on top of that…"
- "That's our next step, and our design already supports it because…"

**Phrases we never say:**
- "We didn't implement that."
- "It doesn't work yet."
- "We didn't have time."
- "It's just fake data."

**Team rules:**
- Every member can explain the full story in 30 seconds.
- One person drives the demo, one answers tech and AI questions, one answers business questions.
- Practice the demo at least 5 times, and record a backup video.

### 24.3 Questions judges may ask (with confident answers)

**"Isn't this just another AI trip planner?"**
Great question! Trip planners stop at the plan. Trizpyy runs the whole trip. It connects travelers, operators and every vendor, and when something breaks, our agent fixes it with every vendor's yes on WhatsApp.

**"What if a vendor never replies?"**
We handle that automatically. Every request has a timer. When time is up, the agent safely undoes the change, tries the next best vendor, and after two tries it alerts a coordinator with a one-tap call.

**"How do you stop the AI from making mistakes?"**
Our AI works inside strong rules. Code calculates times and money, Jev runs safety checks in half a second, and vendors and the traveler confirm before anything changes. Every step is logged and shown live.

**"Why Jev and not just ChatGPT-style models?"**
Jev gives typed answers with a confidence score in milliseconds and can never answer outside our options. That makes it perfect for fast, safe decisions like reading a vendor's yes. Groq writes and talks. Jev decides.

**"Why WhatsApp?"**
Because vendors and travelers in India already live on WhatsApp: about 535 million users. No new app and no login. Our replies inside the 24-hour window are free, and we follow WhatsApp's 2026 rules for business AI assistants.

**"Why Go?"**
Go handles thousands of waiting vendor replies and timers at the same time with very little memory, which is exactly what our confirmation system needs.

**"Is this running live?"**
Yes. The full pipeline runs live: planning, pricing, impact, fix plans, agent, WhatsApp, voice and Jev. For outside events like a real flight delay, our simulator sends a real event into the same live pipeline, so you can see the system react on demand.

**"How will it scale?"**
Our Go servers keep no session state, so we can run many copies behind a load balancer. Postgres with indexes, background jobs on River and cached outside data mean the same design works for 10 tours or 10,000.

**"What can other developers reuse?"**
Our impact and fix engine is an open-source npm and PyPI package called `tripfix`, our confirmation engine `yesflow` is a Go module, and our MCP server lets any AI assistant plan and repair trips.

**"Who pays for this?"**
Tour operators pay a small monthly fee per active tour. Vendors and travelers use it free, which helps the network grow quickly.

---

## 25. Build plan and team roles

### 25.1 Priorities

- **P0 (must):** everything in Section 8 + Hero 2 (Impact + Fix Plans) + Hero 3 (WhatsApp confirmation).
- **P1 (wow):** Hero 1 (Agent), Hero 4 (Voice), Hero 5 (Jev), Hero 6 (Hearts + Mood), Hero 7 (What-If), and packaging `tripfix` for npm.
- **P2 (extra):** Hero 8 (Live Alerts), MCP server, `yesflow` package, and the Section 10 list.

**Rule:** finish P0 fully before starting P1. A working simple feature beats a broken fancy one.

### 25.2 Team roles (for 4 people; for 3, merge roles A and B)

| Role | Owns |
|---|---|
| **A. Traveler frontend** | Next.js traveler screens, design system, animations, map |
| **B. Operator frontend + design** | Operator console, agent timeline, charts, tables, simulator screen, pitch slides |
| **C. Go backend** | API, database, pricing, planner, impact engine, fix planner, all-or-nothing confirmation, WhatsApp integration, WebSockets, River jobs |
| **D. AI + integrations + pitch** | Python optimizer and ML, Groq agent, Jev Decision Service, Whisper voice, weather and flight jobs, demo data, npm package, demo script |

### 25.3 Day-one setup (do first, because some steps need approval time)

- [ ] Meta developer app + WhatsApp test number + 5 verified phones + templates submitted for approval
- [ ] Jev access request + API key
- [ ] Groq API key
- [ ] Razorpay test account
- [ ] Neon database, Vercel project, Render service
- [ ] GitHub repository + Docker Compose

### 25.4 Timeline (for a 36 to 48 hour hackathon; adjust as needed)

| Phase | Hours | Goal |
|---|---|---|
| 0. Setup | 0–3 | Repository, Docker Compose, database schema, demo data, design tokens, API contract, WhatsApp and Jev setup |
| 1. Core plan | 3–12 | Quiz, plan builder, trip builder UI, price calculator, destination browsing |
| 2. Book and ops | 12–20 | Checkout (Razorpay test), operator console (tours, bookings, vendors), WhatsApp booking confirmations, WebSockets |
| 3. Changes | 20–28 | Problems, Change Impact Map, 3 fix plans, all-or-nothing confirmation with undo, Change Receipts |
| 4. Magic | 28–38 | Trip Fixer Agent + timeline, Jev decisions and safety checks, voice notes, mood buttons, hearts, What-If Simulator |
| 5. Polish | 38–44 | Animations, empty and loading states, phone checks, demo mode, `tripfix` on npm, bug fixes |
| 6. Pitch | 44–48 | Practice the 7-minute demo at least 5 times, record a backup video |

---

## 26. Risks and backup plans

| Risk | What could happen | Backup plan |
|---|---|---|
| Groq free limit reached | Agent or AI text stops | Cache, batch, switch models, and the agent's fixed-playbook backup |
| Jev slow or unavailable | No fast decisions | The Decision Service switches to Groq gpt-oss-20b (strict JSON) automatically |
| WhatsApp template not approved in time | Cannot message outside the 24-hour window | Vendors send "Hi" first to open the free window. Web-link backup. |
| WhatsApp test number limit (5 phones) | Not enough phones | Use teammates' phones, and let a judge hold one |
| Webhook cannot reach the laptop | Replies not received | Deploy the backend on Render, or use Cloudflare Tunnel |
| Venue internet fails | Outside services fail | Demo mode with the event simulator and saved data, plus a phone hotspot |
| Free servers sleep (Render) | First request is slow | Wake them 10 minutes before the demo, or run locally |
| Too many features | Nothing finished | Follow the P0 → P1 → P2 order strictly |
| Wrong AI output | Bad change | AI only suggests, code checks the rules, and vendors and humans confirm |
| Data looks fake | Judges lose trust | Real place names, real routes, believable prices, live weather |

---

## 27. Business model and impact

### 27.1 Who pays

- **Tour operators** pay a small monthly fee per active tour (software as a service, or SaaS).
- **Optional commission** on bookings made through the traveler app.
- **Vendors use it free**, so joining is easy, and more vendors make the network better.
- **Travelers use it free.**
- **Open-source packages** bring developers to our platform, and a paid hosted version can come later.

### 27.2 Impact we can show

| Measure | Today (manual) | With Trizpyy |
|---|---|---|
| Time to build a custom itinerary | Up to a few hours | Under 1 minute for the draft |
| Time to handle a disruption with 4 vendors | Hours of calls and messages | A few minutes, handled by the agent |
| Record of changes | Scattered in chats | One Change Receipt per change |
| Half-updated trips | Common | Prevented by all-or-nothing confirmation |
| Traveler updates | Late or missing | Instant, in plain words, on WhatsApp |

---

## 28. What already exists in this folder

We already built a **front-end prototype** (React + Vite + TypeScript) in `src/`. It can be moved into Next.js.

- **Design system:** clay color tokens, tones, shadows, motion and global styles.
- **Illustrations:** 39 clay illustrations (beach, mountain, fort, houseboat, food, transport and more), the mascot "Zippy" and the welcome scene.
- **Screens:** the welcome screen and the home screen, matching the reference design.
- **UI parts:** buttons, chips, art tiles, avatars, quantity steppers, stars, tags, progress bars, energy battery, bottom sheet, toasts, confetti, page header and navigation.
- **Engine logic in TypeScript** (`src/engine/`):
  - plan builder, scheduling and optimizer
  - pricing with promo codes and team-up deals
  - Change Impact engine and 3 fix plans
  - travel personality (DNA), weather, prep checklist and flex dates

  **This logic becomes the first version of our `tripfix` npm package, and can be moved to Go almost line by line.**
- **Demo data** (`src/data/`):
  - 8 Indian destinations: Goa, Manali, Jaipur, Alleppey, Rishikesh, Leh Ladakh, Havelock and Udaipur
  - 64 experiences, 32 stays, vendors, coordinators, promo codes and side quests

To run it, open this folder in a terminal and run `npm install`, then `npm run dev`.

---

## 29. Glossary

| Word | Simple meaning |
|---|---|
| API | A way for two programs to talk to each other over the internet |
| REST | A common style of API that uses web addresses and JSON |
| JSON | A simple text format for data, like `{"name": "Goa"}` |
| WebSocket | A connection that stays open so the server can send updates instantly |
| Webhook | When another service (like WhatsApp or Razorpay) calls our server to tell us something happened |
| LLM | Large language model, an AI that reads and writes text |
| Agent (agentic AI) | An AI that can take steps on its own by using tools, inside limits we set |
| Tool calling | When an AI model asks our code to run a specific function and uses the result |
| MCP | Model Context Protocol, a standard way to give AI assistants tools they can use |
| Strict JSON output | The AI must answer in the exact data shape we define |
| Whisper | An AI model that turns speech into text |
| Jev | A new AI model that gives fixed-type answers (pick one, score, yes/no) very fast, with a confidence number |
| Groq | A company that runs AI models very fast, with a free tier |
| OR-Tools | Free Google software that finds the best order and timing for visits |
| Saga pattern | A safe way to do a change with many steps: if one step fails, the earlier steps are undone |
| Job queue | A list of background tasks that run later or on a timer |
| PWA | A website that can be installed like an app and works offline |
| 24-hour window | On WhatsApp, after a person messages a business, the business can reply freely (and for free) for 24 hours |
| Utility template | A pre-approved WhatsApp message type for updates like bookings, allowed outside the 24-hour window |
| SDK / package | Ready-made code other developers can install and use in their own apps |
| Seed data | Ready-made example data loaded into the database for demos |
| Rate limit | The maximum number of requests a service allows per minute or per day |
| pgvector | A Postgres add-on that stores AI vectors for "find similar" search |
| Vector (embedding) | A list of numbers that describes the meaning of a text, used to find similar things |
| SaaS | Software sold as a monthly subscription |

---

## 30. Sources

**Pain points and industry**
- [MyTrip.AI: 50 challenges for travel agencies and tour operators (2025)](https://mytrip.ai/50-largest-challenges-to-travel-agencies-tour-operators-activity-providers-in-2025/)
- [Lemax: two common pains tour operators face with FIT travel](https://lemax.net/blog/fit-travel-two-most-common-pains-tour-operators-face-and-how-technology-can-solve-them/)
- [Automate.travel: what is tour operator software (2026)](https://automate.travel/learn/what-is-tour-operator-software/)
- [PHPTRAVELS: tour operator CRM guide](https://phptravels.com/blog/tour-operator-crm)
- [TravelBooster: best tour operator software](https://www.travelbooster.com/blog_post/the-best-tour-operator-software/)

**Disruptions**
- [Indian domestic airline market 2025 analysis](https://deepmode.substack.com/p/indian-domestic-airline-market-2025)
- [HappyFares: flight delay rights in India 2026](https://www.happyfares.in/blog/flight-delay-rights-india-2026/)
- [2025 IndiGo disruption (Wikipedia)](https://en.wikipedia.org/wiki/2025_IndiGo_disruption)
- [The Tribune: Himachal monsoon road closures](https://www.tribuneindia.com/news/himachal/roads-closed-bridges-damaged-as-himachal-battles-monsoon-havoc-one-killed-2-injured/)
- [The Tribune: 2,500 tourists stuck in Mussoorie](https://www.tribuneindia.com/news/uttarakhand/rain-fury-2500-tourists-stuck-in-uttarakhands-mussoorie)
- [The Traveler: nearly 1 in 4 flights ran late in 2025](https://www.thetraveler.org/nearly-1-in-4-flights-ran-late-in-2025-as-2026-risks-mount/)
- [Fortune: 89% of travelers bracing for disruption](https://fortune.com/2026/05/19/89-travelers-disruptions-top-concern-paying-more-summer-travel/)

**Groups and WhatsApp usage**
- [SquadTrip: group travel decisions](https://www.squadtrip.com/guides/how-to-make-group-travel-decisions-without-conflict/)
- [WePlanify: group trip budget](https://www.weplanify.com/en/blog/group-trip-budget)
- [Hyperleap: WhatsApp statistics India 2026](https://hyperleap.ai/blog/whatsapp-statistics-india-2026)
- [Hyperleap: WhatsApp business statistics 2026](https://hyperleap.ai/blog/whatsapp-business-statistics-2026)

**WhatsApp platform**
- [Meta: WhatsApp Cloud API get started (test number)](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/)
- [Meta: WhatsApp Business Platform pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [Wati: testing WhatsApp with the free test number](https://www.wati.io/en/blog/test-whatsapp-message-sends-safely/)
- [WhAutomate: WhatsApp API pricing India (July 2026)](https://whautomate.com/whatsapp-business-api-pricing-india)
- [respond.io: WhatsApp 2026 AI policy explained](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)
- [Turn.io: WhatsApp 2026 AI policy](https://learn.turn.io/l/en/article/khmn56xu3a-whats-app-s-2026-ai-policy-explained)
- [Unipile: what is free on the WhatsApp API in 2026](https://www.unipile.com/is-the-whatsapp-api-free/)

**Competitors**
- [Travel Anywhere: Mindtrip vs Layla vs Wanderlog tested (2026)](https://www.travelanywhere.blog/blog/best-agentic-ai-travel-apps-2026-mindtrip-layla-stippl-stardrift-wanderlog-tested)
- [Layla: AI trip planners tier list](https://layla.ai/blog/news-and-tips/ai-trip-planners-tier-list)
- [Hopper: Disruption Assistance](https://hts.hopper.com/products/disruption-assistance)

**AI and tools**
- [Groq rate limits (official)](https://console.groq.com/docs/rate-limits)
- [Groq structured outputs (official)](https://console.groq.com/docs/structured-outputs)
- [Groq free tier changes 2026](https://klymentiev.com/blog/groq-pricing)
- [What is Jev (DigitalOcean)](https://www.digitalocean.com/resources/articles/what-is-jev)
- [Jev (Wikipedia)](https://en.wikipedia.org/wiki/Jev_(AI_model))
- [Bhashini: free Indian language APIs](https://schemesinindia.in/central/bhashini-digital-india-language-ai-platform)
- [Google OR-Tools: routing with time windows](https://developers.google.com/optimization/routing/vrptw)

**Free services**
- [Open-Meteo pricing and limits](https://open-meteo.com/en/pricing)
- [OpenFreeMap](https://openfreemap.org/)
- [OSRM](https://project-osrm.org/)
- [Free flight APIs 2026](https://thunderbit.com/blog/best-flight-api-with-free-tiers)
- [Free backend hosting 2026](https://snapdeploy.dev/blog/free-backend-hosting-2026-apis-servers)
- [Free Postgres tiers 2026 (Koyeb)](https://www.koyeb.com/blog/top-postgresql-database-free-tiers-in-2026)

**Design and judging**
- [Setproduct: retro and brutalist UI field guide 2026](https://www.setproduct.com/blog/retro-brutalist-ui-design-2026)
- [Brandemic: UI design trends 2026](https://brandemic.in/blog/must-know-ui-design-trends)
- [AngelHack: what repeat hackathon winners do](https://angelhack.com/blog/hackathon-tips-for-winners/)
- [Masai: how to win an AI hackathon in 2026](https://www.masaischool.com/blog/how-to-win-an-ai-hackathon-in-2026-full-guide/)
