import type { TravelCategory, TravelSafetyGuidance } from "@workspace/api-zod";

// Educational examples adapted from FTC travel advice, not attributable reports
// about any particular business or phone number. Never pass these to decide().
const examples: Record<TravelCategory, { title: string; warning: string; next: string }> = {
  airline: {
    title: "Flight changed? Take one step at a time.",
    warning: "Someone rushes you to pay a rebooking fee outside your original booking.",
    next: "Open the airline app or original booking to confirm the change and any fee.",
  },
  hotel: {
    title: "Your room can wait while you check.",
    warning: "A message says your room will be cancelled unless you immediately pay through a new link.",
    next: "Use the hotel contact in your booking or its own website to confirm any payment request.",
  },
  vacation_rental: {
    title: "Check your stay before sending money.",
    warning: "A host asks for an off-platform deposit, or the same property appears under different owners.",
    next: "Keep messages and payments in the booking platform. Check the property address and listing there.",
  },
  car_rental: {
    title: "A pickup problem does not need a rushed payment.",
    warning: "Someone insists on gift cards or a personal payment-app transfer to release your rental.",
    next: "Contact the rental company through your reservation and confirm the payment terms.",
  },
  booking_service: {
    title: "Check the booking, not the pressure.",
    warning: "An unexpected support message asks for a new payment or a one-time login code to fix a booking.",
    next: "Open the booking service yourself and use support inside your reservation. Keep login codes private.",
  },
  rail_transfer: {
    title: "Changed plans? Confirm your next ride.",
    warning: "An unexpected caller says your transfer is cancelled and demands an immediate replacement payment.",
    next: "Check the operator's own app or the transfer contact in your original confirmation.",
  },
  cruise: {
    title: "You have time to check the offer.",
    warning: "A supposedly free cruise requires upfront fees, or the seller will not name the ship and itinerary.",
    next: "Confirm the sailing and total price directly with the cruise line or your original travel agent.",
  },
  tour: {
    title: "Keep your day out on your terms.",
    warning: "A seller pressures you to pay now but will not provide the operator, meeting point, or refund terms.",
    next: "Confirm the activity and meeting point in your original booking before paying for a change.",
  },
};

export const travelSafety: TravelSafetyGuidance[] = Object.entries(examples).map(([category, example]) => ({
  category: category as TravelCategory,
  title: example.title,
  warningSigns: [example.warning, "Pressure to decide now, or demands for gift cards, wire transfers, or cryptocurrency."],
  nextSteps: ["Pause. You do not need to decide on an unexpected call.", example.next],
  sourceUrl: "https://consumer.ftc.gov/articles/avoid-scams-when-you-travel",
  disclaimer: "General travel-safety guidance with illustrative situations, not a report about this company or number. An unverified number is not proof of a scam.",
}));

export function guidanceFor(category: TravelCategory) {
  return travelSafety.find((guide) => guide.category === category)!;
}
