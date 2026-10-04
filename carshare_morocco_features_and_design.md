# CarShare Morocco: Peer-to-Peer Car Rental Web App
## Product Requirements & Design Specification (MVP)

### 1. Product Concept & Vision
**CarShare Morocco** is an Airbnb-style peer-to-peer automotive marketplace designed to bypass the bureaucratic hurdles, hidden fees, and rigid constraints of traditional Moroccan car rental agencies. The platform connects car owners looking to monetize their idle vehicles with verified drivers (locals and tourists) seeking flexible, transparent, and authentic mobility options across Morocco.

---

### 2. Design Language & Aesthetics
To appeal to modern users while reflecting a sleek, high-end feel, the web application utilizes a **"Liquid Glass / Glassmorphism"** design system combined with clean, geometric typography.

*   **Typography:** Primary font family is **Century Gothic** (clean, geometric, minimalist sans-serif) paired with clean fallback sans-serif fonts for optimal readability.
*   **Visual Style (Liquid Glassmorphism):**
    *   **Backgrounds:** Deep, rich atmospheric gradients (e.g., Moroccan indigo blues, dusk terracotta, or sleek dark-mode slate with vibrant neon or frosted color bleeds) to make glass layers pop.
    *   **Containers & Cards:** Translucent white/dark glass (`rgba` values with backdrop blur `backdrop-filter: blur(16px)`), subtle 1px semi-transparent borders, and soft layered shadows (`box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37)`).
    *   **Micro-Interactions:** Smooth, fluid transitions, liquid hover states, and seamless modal popups that feel weightless yet tactile.

---

### 3. Core Web App Features (MVP)

#### A. User Authentication & Trust & Safety (Moroccan Context)
*   **Dual-Profile System:** Seamless switching between "Renter" and "Host" modes within a single account.
*   **Moroccan ID & License Verification:** 
    *   Digital upload and instant OCR/AI verification of Moroccan CIN (Carte Nationale d'Identité) or Passport for foreigners.
    *   Driver's License verification (permis de conduire marocain or international permit) with validity check.
*   **Phone & WhatsApp Verification:** OTP verification via SMS and integration with WhatsApp for instant communication channels popular in Morocco.
*   **Trust Score & Badges:** Ratings, reviews, and verification badges ("Verified Host", "SuperDriver").

#### B. Search, Discovery & Geolocation (Moroccan Market)
*   **Interactive Map & List View:** Filter cars by city (Casablanca, Marrakech, Tangier, Rabat, Agadir, etc.), neighborhoods, airports (Mohammed V, Marrakech Menara, etc.), and delivery options.
*   **Advanced Filters:** 
    *   Transmission (Manual is dominant in Morocco, but automatic is in high demand).
    *   Fuel Type (Diesel vs. Gasoline vs. Hybrid).
    *   Price range (in Moroccan Dirhams - MAD).
    *   Instant Booking vs. Request to Book.
    *   Car category (City car like Dacia Logan/Sandero, SUVs, Luxury).

#### C. Listing Creation Wizard for Hosts ("List Your Car")
*   **Step 1: Vehicle Details:** License plate lookup, brand, model, year, transmission, fuel type, and mileage. (Special tags for popular Moroccan models like Dacia, Renault, Hyundai).
*   **Step 2: Pricing & Availability:** Daily rate suggestions based on local market data, custom seasonal pricing, and calendar management.
*   **Step 3: Location & Delivery:** Setting a pickup point or offering hotel/airport delivery service for an extra fee.
*   **Step 4: Photography & Description:** Guided photo upload prompts (exterior, interior, odometer) and multi-lingual description (Darija, French, English).

#### D. Booking & Checkout Flow
*   **Flexible Dates & Times:** Hourly or daily rental options with clear transparent pricing breakdowns (rental fee, service fee, optional insurance).
*   **Moroccan Payment Integration:** 
    *   Support for local bank cards (CMI / Interbank Moroccan cards).
    *   International credit/debit cards (Visa, Mastercard).
    *   Cash-on-pickup options backed by a strict deposit/cancellation policy (if applicable for trusted profiles).
*   **Digital Rental Agreement:** Automatically generated electronic contract compliant with Moroccan transport and civil regulations.

#### E. Handover & Trip Management Dashboard
*   **Pre-Trip Inspection Checklist:** Digital walkaround photo upload before handover to document existing scratches/dents, preventing disputes.
*   **In-App Chat & WhatsApp Sync:** Built-in messaging with automated translation assistance (French/Arabic/English) and quick WhatsApp jump buttons.
*   **Trip Status Tracker:** Active, upcoming, completed, and canceled booking history with invoice downloads.

#### F. Reviews & Resolution Center
*   Two-way review system (Host reviews renter, renter reviews car/host).
*   Dispute resolution ticket system for late returns, minor damages, or extra mileage fees.

---

### 4. Technical & Architectural Considerations for Morocco
*   **Performance:** Lightweight glassmorphism CSS optimized for mobile browsers and varying network speeds across regions.
*   **Localization:** Fully bilingual interface supporting **French** (standard for Moroccan business/legal documents) and **Modern Standard Arabic / Moroccan Darija** options, alongside English for international tourists.
*   **Currency:** Native display in Moroccan Dirhams (MAD) with currency conversion display for tourists.